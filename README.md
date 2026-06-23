# inputwerk

Portable Linux keymap recipes for XKB, Wayland and desktop targets.

`inputwerk` is a Bun-based CLI that turns a complete XKB keymap into reusable
components, validates the resulting RMLVO configuration with libxkbcommon, and
installs it for desktop targets such as COSMIC.

The checked-in `keymaps/amelie.full.xkb` is the source of truth. The CLI splits
that complete `xkb_keymap` into the component files that libxkbcommon resolves
through RMLVO (`rules`, `model`, `layout`, `variant`, `options`). Generated files
are deliberately not committed.

```console
bun run validate
bun run install:cosmic
```

The default installation is user-local in `~/.config/xkb`. If the compositor's
environment does not search that directory, use `/etc/xkb`:

```console
bun run keymap install --target cosmic --scope etc
```

`--scope system` installs into `/usr/share/X11/xkb` and is only a fallback;
package upgrades may overwrite that directory.

To replace the source map and validate it immediately:

```console
bun run keymap import --source /path/to/complete-map.xkb
```

Build a standalone executable with the full map embedded:

```console
bun run build:binary
./dist/inputwerk validate
```
