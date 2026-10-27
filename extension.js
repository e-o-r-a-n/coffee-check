// SPDX-License-Identifier: GPL-2.0-or-later
// extension.js — Coffee Check
// Tracks your coffee's temperature using Newton's law of cooling
// and notifies you when it's ready to drink.

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const TARGET_PRESETS = [55, 60, 65];

const CoffeeIndicator = GObject.registerClass(
class CoffeeIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Coffee Check'), false);

        // Physical parameters (Newton's law of cooling)
        this.T_initial = 85;   // Initial coffee temperature (°C)
        this.T_ambient = 23;   // Room temperature (°C)
        this.T_target = 60;    // Drinking temperature (°C)
        this.k = 0.002;        // Cooling constant (s⁻¹)

        // State: 'idle' (no coffee) or 'cooling'
        this.state = 'idle';
        this.startTime = 0;
        this.timeout = null;
        this.notificationSent = false;

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this.coffeeIcon = new St.Label({
            text: '☕',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 16px; margin-right: 4px;',
        });
        this.tempLabel = new St.Label({text: '', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this.coffeeIcon);
        box.add_child(this.tempLabel);
        this.add_child(box);

        this._createMenu();
        this._renderIdle();

        // Always clean up the timer when the indicator is destroyed
        this.connect('destroy', () => this._stopTimer());
    }

    _createMenu() {
        this.timeItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this.estimatedItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this.menu.addMenuItem(this.timeItem);
        this.menu.addMenuItem(this.estimatedItem);

        // Submenu to choose the target temperature
        this.targetSub = new PopupMenu.PopupSubMenuMenuItem('');
        for (const t of TARGET_PRESETS) {
            const item = new PopupMenu.PopupMenuItem(_('%d°C').format(t));
            item.connect('activate', () => {
                this.T_target = t;
                this.notificationSent = false;
                this._refresh();
            });
            this.targetSub.menu.addMenuItem(item);
        }
        this.menu.addMenuItem(this.targetSub);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const newItem = new PopupMenu.PopupMenuItem(_('☕ New coffee'));
        newItem.connect('activate', () => this._start());
        this.menu.addMenuItem(newItem);

        this.stopItem = new PopupMenu.PopupMenuItem(_('✕ Stop'));
        this.stopItem.connect('activate', () => this._stop());
        this.menu.addMenuItem(this.stopItem);
    }

    // ---- Physics ----
    _temperatureAt(t) {
        return this.T_ambient + (this.T_initial - this.T_ambient) * Math.exp(-this.k * t);
    }

    _timeToTarget() {
        const a = this.T_initial - this.T_ambient;
        const b = this.T_target - this.T_ambient;
        if (a <= 0 || b <= 0 || b >= a)
            return 0;
        return -Math.log(b / a) / this.k;
    }

    _now() {
        // Monotonic clock: unaffected by system time changes (NTP, DST)
        return GLib.get_monotonic_time() / 1e6;
    }

    _formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m > 0
            ? _('%d min %d s').format(m, sec)
            : _('%d s').format(sec);
    }

    // ---- States ----
    _start() {
        this.state = 'cooling';
        this.startTime = this._now();
        this.notificationSent = false;
        this._startTimer();
    }

    _stop() {
        this._stopTimer();
        this.state = 'idle';
        this._renderIdle();
    }

    _renderIdle() {
        this.tempLabel.set_text('');
        this.coffeeIcon.opacity = 120; // dimmed icon = nothing running
        this.timeItem.label.set_text(_('No coffee brewing'));
        this.estimatedItem.label.set_text(_('Click “New coffee” to start'));
        this.targetSub.label.set_text(_('Target temperature: %d°C').format(this.T_target));
        this.stopItem.visible = false;
    }

    _refresh() {
        if (this.state === 'idle') {
            this._renderIdle();
            return GLib.SOURCE_REMOVE;
        }

        const elapsed = this._now() - this.startTime;
        const temp = this._temperatureAt(elapsed);

        this.coffeeIcon.opacity = 255;
        this.stopItem.visible = true;
        // Rounded value: shorter, so it fits in a crowded top bar
        this.tempLabel.set_text(_('%d°C').format(Math.round(temp)));
        this.timeItem.label.set_text(_('Elapsed: %s').format(this._formatTime(elapsed)));
        this.targetSub.label.set_text(_('Target temperature: %d°C').format(this.T_target));

        if (temp > this.T_target) {
            const remaining = Math.max(0, this._timeToTarget() - elapsed);
            this.estimatedItem.label.set_text(
                _('Time left: %s').format(this._formatTime(remaining)));
        } else {
            this.estimatedItem.label.set_text(_('✓ Ready to drink!'));
            if (!this.notificationSent) {
                Main.notify(
                    _('☕ Coffee Check'),
                    _('Your coffee is at %d°C — enjoy it now!').format(this.T_target));
                this.notificationSent = true;
            }
        }

        // Stop automatically once the coffee is nearly cold: no useless timer
        if (temp < this.T_ambient + 5) {
            this._stopTimer();
            this.state = 'idle';
            this._renderIdle();
            return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
    }

    _startTimer() {
        this._stopTimer();
        this._refresh();
        this.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            const result = this._refresh();
            if (result === GLib.SOURCE_REMOVE)
                this.timeout = null;
            return result;
        });
    }

    _stopTimer() {
        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
    }
});

export default class CoffeeCheckExtension extends Extension {
    enable() {
        this._indicator = new CoffeeIndicator();
        // Position 0 in the right box: first item, before other extensions' icons
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
