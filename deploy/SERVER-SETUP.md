# Production server setup (P1.5)

One-time setup so release scripts can publish the portal and games to `games.soncrant.com` **without sudo**. The owner runs every `sudo` command; Claude never gets root.

- **Server:** Debian 13, Apache 2.4, HTTP on port 80 (ADR-010)
- **Deploy source:** the dev machine
- **Addresses:** this public repo never contains them. `<SERVER>` and `<DEV_MACHINE_IP>` below come from the untracked file `deploy/server.env` on the dev machine (template: `deploy/server.env.example`). Claude gives you the real values in the chat.
- **What this creates:**
  - a `deploy` user that can write only to the games web folder and a releases folder
  - SSH login with one key, from the dev machine only

Nothing here changes Apache or any existing site. Apache settings are in Step 5, which is a separate step for the owner to apply.

---

## Layout

```
/var/www/html/soncrant.com/pub/games/        ← games.soncrant.com document root (portal)
├── index.html, assets/, images/, favicon.png   portal files
└── star-destroyer -> /srv/games-releases/star-destroyer/20261017-120000   (symlink)

/srv/games-releases/                         ← not web-served
└── star-destroyer/
    ├── 20261017-120000/   (live)
    └── 20261016-090000/   (previous, for rollback)
```

**Why a releases folder outside the web root:** each game release is uploaded in full, then the game's symlink is switched in one step (atomic). Rolling back means pointing the symlink at the previous folder. Old releases are never reachable from the web. This is the "folder outside `pub/`" option from ADR-009.

---

## Step 1 — Look before changing anything (read-only)

Run these and paste the output back to Claude. They change nothing.

```sh
# Apache sites and which config serves what
sudo apachectl -S
grep -Rn -i -E "soncrant|games" /etc/apache2/sites-enabled/ /etc/apache2/conf-enabled/

# Existing folders and owners
ls -ld /var/www/html/soncrant.com /var/www/html/soncrant.com/pub /var/www/html/soncrant.com/pub/games 2>&1
ls -ld /srv 2>&1

# SSH settings that matter for a new key-only user
sudo sshd -T | grep -E "^(port|passwordauthentication|pubkeyauthentication|permitrootlogin|allowusers|allowgroups|authenticationmethods) "

# Is there already a deploy user?
id deploy 2>&1
```

**Why:** to confirm the paths exist and who owns them, and to check whether `sshd` limits which users may log in. It also explains the redirect we see today: a request to `http://games.soncrant.com/` on port 80 currently returns `302`.

## Step 2 — Create the `deploy` user (no password, no sudo)

```sh
sudo adduser --disabled-password --gecos "Soncrant Arcade deploys" deploy
sudo passwd -l deploy          # lock the password: key login only
```

- `deploy` is **not** added to `sudo` or any other group except its own.
- Check: `sudo -l -U deploy` should say it may not run sudo.

## Step 3 — Folders it may write to

```sh
# Web root for games.soncrant.com: deploy writes, Apache (www-data group) reads.
sudo install -d -o deploy -g www-data -m 2755 /var/www/html/soncrant.com/pub/games

# Releases folder outside the web root.
sudo install -d -o deploy -g www-data -m 2755 /srv/games-releases
```

- **Mode `2755`:** the owner (`deploy`) can write. Group and others can read and enter but not write. The setgid bit (`2`) makes new files inherit the `www-data` group.
- If `pub/games` already exists with files in it, **stop and tell Claude** before running the first line, so nothing gets overwritten.

## Step 4 — Allow one SSH key, from the dev machine only

Claude will create a dedicated key on the dev machine and send you its **public** half: one line starting with `ssh-ed25519`. Install it with these restrictions:

```sh
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
echo 'from="<DEV_MACHINE_IP>",restrict ssh-ed25519 AAAA...REPLACE... soncrant-deploy' \
  | sudo tee /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

- `from="<DEV_MACHINE_IP>"`: the key is refused from any other address, even if it were copied off the dev machine. If the dev machine's address changes (DHCP), this line must be updated. A DHCP reservation for it avoids that.
- `restrict`: no port forwarding, agent forwarding, X11 or interactive terminal. Plain commands and file copies (`rsync`) still work.

If Step 1 showed an `AllowUsers` or `AllowGroups` line, add `deploy` to it, then run `sudo sshd -t && sudo systemctl reload ssh`. `sshd -t` checks the config first, so a typo can't lock you out.

`rsync` must be installed on the server: `sudo apt install rsync` (skip if `which rsync` prints a path).

## Step 5 — Apache (owner applies; Claude supplies the exact config in P1.6)

The `games.soncrant.com` site needs:

| Setting | Why |
|---|---|
| `DocumentRoot /var/www/html/soncrant.com/pub/games` | the portal is the site's home page |
| `Options -Indexes +SymLinksIfOwnerMatch` | no folder listings; follow a game's symlink only when the link and its target have the same owner (`deploy`) |
| `<Directory /srv/games-releases>` `Require all granted` | lets Apache read the release folders that the symlinks point into. They still can't be requested by URL, because they're outside the document root |
| `AllowOverride None` | ignore `.htaccess` files, so a release can't change server settings |
| Security headers (CSP and others) | in the P1.6 config, checked with `apachectl configtest` before reload |

## Step 6 — Check it works (Claude runs this from the dev machine)

```sh
ssh -i ~/.ssh/soncrant_deploy deploy@<SERVER> 'id && touch /srv/games-releases/.probe && rm /srv/games-releases/.probe && echo write-ok'
ssh -i ~/.ssh/soncrant_deploy deploy@<SERVER> 'touch /etc/probe' # must FAIL (permission denied)
ssh -i ~/.ssh/soncrant_deploy deploy@<SERVER> 'sudo -n true'     # must FAIL (no sudo)
```

## Undo

```sh
sudo deluser --remove-home deploy
sudo rm -rf /srv/games-releases          # only after taking the games offline
```

This removes the user and its key. The `pub/games` folder and anything already published stay until you remove them.
