// src/curlCounter.ts
export function angleBetween(a, b, c) {
    const ba = [a[0] - b[0], a[1] - b[1]];
    const bc = [c[0] - b[0], c[1] - b[1]];
    const dot = ba[0] * bc[0] + ba[1] * bc[1];
    const det = ba[0] * bc[1] - ba[1] * bc[0];
    let ang = Math.atan2(Math.abs(det), dot) * 180 / Math.PI;
    if (ang < 0)
        ang = 0;
    if (ang > 180)
        ang = 180;
    return ang;
}
export const euclid2d = (p, q) => {
    const dx = p[0] - q[0], dy = p[1] - q[1];
    return Math.sqrt(dx * dx + dy * dy);
};
export class CurlCounter {
    up_thresh = 40.0;
    down_thresh = 155.0;
    elbow_disp_thresh = 0.06;
    min_concentric_time = 0.25;
    min_delta_angle = 30.0;
    state = "idle";
    reps = 0;
    last_angle;
    last_t;
    velocity = 0;
    // per-rep tracking
    _start_time = null;
    _t_peak = null;
    _start_angle = null;
    _min_angle = null;
    _start_elbow_rel = null;
    _max_elbow_disp = 0;
    _pcv = 0;
    _conc_sum = 0;
    _conc_time = 0;
    // per-set
    pcv_list = [];
    mcv_list = [];
    last_rep_pcv = null;
    last_rep_mcv = null;
    set_index = 1;
    _flash_until = 0;
    // web: per-set rep rows
    rep_history = [];
    reset_set(now = performance.now() / 1000) {
        this.reps = 0;
        this.state = "idle";
        this.last_angle = undefined;
        this.last_t = undefined;
        this.velocity = 0;
        this._start_time = null;
        this._t_peak = null;
        this._start_angle = null;
        this._min_angle = null;
        this._start_elbow_rel = null;
        this._max_elbow_disp = 0;
        this._pcv = 0;
        this._conc_sum = 0;
        this._conc_time = 0;
        this.pcv_list = [];
        this.mcv_list = [];
        this.last_rep_pcv = null;
        this.last_rep_mcv = null;
        this.rep_history = [];
        this.set_index += 1;
        this._flash_until = now + 1.2;
    }
    should_flash_banner(nowSec) { return nowSec <= this._flash_until; }
    step(angle, nowSec, elbow_rel, visible = true) {
        if (this.last_angle == null) {
            this.last_angle = angle;
            this.last_t = nowSec;
            return { reps: this.reps, vel: 0, state: this.state, last_rep_pcv: null, last_rep_mcv: null, set_avgs: null };
        }
        const dt = Math.max(1e-3, nowSec - (this.last_t ?? nowSec));
        const vel = (angle - (this.last_angle ?? angle)) / dt;
        this.last_angle = angle;
        this.last_t = nowSec;
        this.velocity = vel;
        if (!visible) {
            return { reps: this.reps, vel, state: this.state, last_rep_pcv: null, last_rep_mcv: null, set_avgs: null };
        }
        const up_hit = angle <= this.up_thresh;
        const down_hit = angle >= this.down_thresh;
        if ((this.state === "idle" || this.state === "returning") && down_hit) {
            this.state = "going";
            this._start_time = nowSec;
            this._start_angle = angle;
            this._min_angle = angle;
            this._start_elbow_rel = elbow_rel ?? null;
            this._max_elbow_disp = 0;
            this._pcv = 0;
            this._conc_sum = 0;
            this._conc_time = 0;
        }
        else if (this.state === "going") {
            const conc_v = Math.max(0, -vel);
            if (conc_v > this._pcv)
                this._pcv = conc_v;
            this._conc_sum += conc_v * dt;
            this._conc_time += dt;
            if (elbow_rel && this._start_elbow_rel) {
                const dx = elbow_rel[0] - this._start_elbow_rel[0];
                const dy = elbow_rel[1] - this._start_elbow_rel[1];
                const drift = Math.sqrt(dx * dx + dy * dy);
                if (drift > this._max_elbow_disp)
                    this._max_elbow_disp = drift;
            }
            if (this._min_angle == null || angle < this._min_angle)
                this._min_angle = angle;
            if (up_hit) {
                this.state = "peak";
                this._t_peak = nowSec;
            }
        }
        else if (this.state === "peak" && down_hit) {
            const rom = ((this._start_angle ?? angle) - (this._min_angle ?? angle));
            const t_up = (this._t_peak && this._start_time) ? (this._t_peak - this._start_time) : 0;
            const stable = this._max_elbow_disp <= this.elbow_disp_thresh;
            const enough_time = t_up >= this.min_concentric_time;
            const enough_rom = rom >= this.min_delta_angle;
            if (stable && enough_time && enough_rom) {
                this.reps += 1;
                const mcv = this._conc_time > 0 ? (this._conc_sum / this._conc_time) : 0;
                this.last_rep_pcv = this._pcv;
                this.last_rep_mcv = mcv;
                this.pcv_list.push(this._pcv);
                this.mcv_list.push(mcv);
                this.rep_history.push({
                    set: this.set_index,
                    rep: this.reps,
                    pcv: this._pcv,
                    mcv,
                    rom,
                    t_conc: this._conc_time,
                    t_start: this._start_time ?? 0,
                    t_peak: this._t_peak ?? 0,
                    t_end: nowSec
                });
            }
            this.state = "returning";
            this._start_time = null;
            this._t_peak = null;
            this._start_angle = null;
            this._min_angle = null;
            this._start_elbow_rel = null;
            this._max_elbow_disp = 0;
            this._pcv = 0;
            this._conc_sum = 0;
            this._conc_time = 0;
        }
        const set_avg_pcv = this.pcv_list.length ? average(this.pcv_list) : null;
        const set_avg_mcv = this.mcv_list.length ? average(this.mcv_list) : null;
        return {
            reps: this.reps,
            vel,
            state: this.state,
            last_rep_pcv: this.last_rep_pcv,
            last_rep_mcv: this.last_rep_mcv,
            set_avgs: (set_avg_pcv != null && set_avg_mcv != null) ? [set_avg_pcv, set_avg_mcv] : null
        };
    }
}
const average = (a) => a.reduce((s, x) => s + x, 0) / a.length;
//# sourceMappingURL=curlCounter.js.map