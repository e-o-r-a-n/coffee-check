# ☕ Coffee Check

A GNOME Shell extension that tracks your coffee's temperature in real time and notifies you when it's ready to drink.

The temperature is estimated with Newton's law of cooling, starting from a freshly brewed coffee (85 °C) in a 23 °C room.

## Features

- Live temperature in the top bar
- Time left until your coffee reaches the target temperature
- Notification when it's ready to drink
- Choice of target temperature (55, 60 or 65 °C)
- Idle until you start a new coffee — nothing runs in the background
- Available in English and French

## Installation

### From extensions.gnome.org

Coming soon.

### Manual

```bash
git clone https://github.com/e-o-r-a-n/coffee-check.git
cd coffee-check
gnome-extensions pack --podir=po --force
gnome-extensions install --force coffee-check@gryfen.shell-extension.zip
```

Log out and back in, then enable it:

```bash
gnome-extensions enable coffee-check@gryfen
```

## Usage

Click the ☕ icon in the top bar, then **New coffee** when you pour your cup.

## Compatibility

GNOME Shell 45 to 48.

Generated with AI
