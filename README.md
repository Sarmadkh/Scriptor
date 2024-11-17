# Scriptor
A Chrome Extension that lets you inject CSS and JS code

It have the option to Inject Custom CSS and JS snippets to any website.

## Features

1. Inject code from Context Menu.
2. Auto Inject code when site loads.
3. Redirect sites to another page (full sites or part of url).
4. Backup and Restore your snippets.

## How to use Redirect feature?

Wildcards are the simplest way to specify include and exclude patterns. When you create a wildcard pattern there is just one special character, the asterisk *. An asterisk in your pattern will match zero or more characters and you can have more than one star in your pattern. Some examples:

- __http://example.com/*__ matches http://example.com/, http://example.com/foo, http://example.com/bar and all other urls that start with http://example.com/.
- __http://*.example.com__ matches all subdomains of example.com, like http://www.example.com, http://mail.example.com.
- __http*://example.com__ matches both http://example.com and https://example.com.
- __http://example.com/index.asp*__ matches http://example.com/index.asp, http://example.com/index.asp?a=b&c=d.

$1, $2, $3 in the redirect urls will match the text that the stars matched. Examples:
- __http://example.com/*__ matches http://example.com/foobar, $1 is foobar.
- __http://*.example.com/*__ matches http://www.example.com/foobar, $1 is www, $2 is foobar.


## Todo List
1. ~~Make a code run on all sites~~
2. ~~Enable/Disable a snippet~~
