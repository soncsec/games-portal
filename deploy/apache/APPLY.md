# Applying the games.soncrant.com Apache config (P1.6)

The owner applies this. It changes **only** the `# Games site` block in `/etc/apache2/sites-enabled/soncrant-sites.conf`; every other site stays as it is.

## 1. Check `mod_headers` is on

```sh
apache2ctl -M 2>/dev/null | grep headers_module || echo "headers is OFF"
```

If it's off: `sudo a2enmod headers`. This only loads the module and changes no site's behaviour.

## 2. Back up the current file

```sh
sudo cp -a /etc/apache2/sites-enabled/soncrant-sites.conf /root/soncrant-sites.conf.$(date +%Y%m%d-%H%M%S)
```

`sites-enabled/soncrant-sites.conf` may be a symlink into `sites-available/`. `cp -a` copies what it points to either way, and the edit below goes through the link.

## 3. Replace the games block

Open the file (`sudo nano /etc/apache2/sites-enabled/soncrant-sites.conf`). Replace everything from `# Games site` through the first `</VirtualHost>` after it with the contents of [`games-vhost.conf`](games-vhost.conf).

Today that block is 10 lines (about lines 21–30): `ServerName`, `ServerAlias`, `DocumentRoot`, `ErrorLog` and `CustomLog`. The new block keeps all five and adds the folder rules, security headers and caching.

## 4. Test, then reload

```sh
sudo apachectl configtest      # must print "Syntax OK"
sudo systemctl reload apache2  # only if the line above said Syntax OK
```

`reload` is graceful: requests in progress finish, and no site goes down. If `configtest` reports an error, don't reload. Restore the backup from step 2 (or fix the typo) and tell Claude.

## 5. Check

Claude runs these from the dev machine; you can too:

```sh
curl -sI -H "Host: games.soncrant.com" http://<SERVER>/ | grep -i -E "content-security|x-frame|x-content-type|referrer|permissions|cross-origin|cache-control"
curl -s  -H "Host: games.soncrant.com" http://<SERVER>/ | head -5     # not a folder listing
curl -sI -H "Host: www.soncrant.com"   http://<SERVER>/ | head -1     # another site, unchanged
```

## Undo

Restore the backup from step 2, then run `sudo apachectl configtest && sudo systemctl reload apache2`.
