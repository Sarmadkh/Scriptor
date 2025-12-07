# Scriptor

A Chrome Extension that lets you inject JS and CSS code to any website.

## 🚀 Features

1. **Context Menu Injection:** Run scripts on demand by right-clicking a page.
2. **Auto Injection:** Automatically run code snippets when a specific site loads.
3. **Advanced Redirects:** Redirect sites to another page (full domains or specific paths) using wildcards.
4. **Site Grouping:** Organize your rules by website for better management.
5. **Backup & Restore:** Export your configurations to JSON and restore them anytime.

## 📥 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in the top right corner).
4. Click **Load Unpacked**.
5. Select the folder containing the Scriptor source code.

## 📖 How to use the Redirect feature

Wildcards are the simplest way to specify include and exclude patterns. When you create a wildcard pattern there is just one special character: the asterisk `*`.

An asterisk in your pattern will match **zero or more characters** and you can have more than one star in your pattern.

### Matching Examples

- `http://example.com/*`
  - Matches: `http://example.com/`, `http://example.com/foo`, `http://example.com/bar`
  - Matches all other URLs that start with `http://example.com/`.

- `http://*.example.com`
  - Matches all subdomains of example.com.
  - Matches: `http://www.example.com`, `http://mail.example.com`.

- `http*://example.com`
  - Matches both `http://example.com` and `https://example.com`.

- `http://example.com/index.asp*`
  - Matches: `http://example.com/index.asp`, `http://example.com/index.asp?a=b&c=d`.

### Dynamic Replacements ($1, $2, ...)

You can use `$1`, `$2`, `$3` in the **Target URL** to inject the text matched by the wildcards.

**Example 1:**
- **From:** `http://example.com/*`
- **To:** `http://example.com/moved/$1`
- **Result:** `http://example.com/foobar` redirects to `http://example.com/moved/foobar`
- *Explanation:* `$1` is `foobar`.

**Example 2:**
- **From:** `http://*.example.com/*`
- **To:** `http://example.org/$2?sub=$1`
- **Result:** `http://www.example.com/foobar` redirects to `http://example.org/foobar?sub=www`
- *Explanation:* `$1` is `www` (the first wildcard), `$2` is `foobar` (the second wildcard).

## 📝 Todo List / Roadmap

- [x] Make a code run on all sites (Global Rules)
- [x] Enable/Disable a snippet
- [x] Grouping of Rules by Site
- [x] Import / Export functionality
- [ ] Syntax Highlighting in Editor
- [ ] Cloud Sync

## License

MIT
