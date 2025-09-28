// src/app.ts
import { angleBetween, euclid2d, CurlCounter } from "./curlCounter";
export class BicepCurlApp {
    // landmark indices
    L_SHO = 11;
    L_ELB = 13;
    L_WRI = 15;
    R_SHO = 12;
    R_ELB = 14;
    R_WRI = 16;
    counter = new CurlCounter();
    // double-clap params
    clap_dist_thresh = 0.038;
    clap_vis_thresh = 0.50;
    clap_min_gap = 0.25;
    clap_window = 1.80;
    clap_min_open = 0.18;
    clap_cooldown = 0.80;
    _last_close = false;
    _last_far_t = performance.now() / 1000;
    _last_clap_t = 0;
    _first_clap_t = null;
    _set_cooldown_until = 0;
    sets_completed = 0;
    set_history = [];
    current_set_start = performance.now() / 1000;
    rep_history = [];
    show_clap_debug = true;
    _last_clap_dist = 0;
    drain_rep_history() {
        if (this.counter.rep_history.length) {
            this.rep_history.push(...this.counter.rep_history);
            this.counter.rep_history = [];
        }
    }
    commit_set(now, reason = "double_clap") {
        this.drain_rep_history();
        const reps = this.counter.reps;
        const pcvs = this.counter.pcv_list;
        const mcvs = this.counter.mcv_list;
        if (reps === 0 && pcvs.length === 0) {
            this.current_set_start = now;
            return;
        }
        const set_summary = {
            set: this.counter.set_index,
            reps,
            pcv_avg: pcvs.length ? avg(pcvs) : 0,
            pcv_max: pcvs.length ? Math.max(...pcvs) : 0,
            mcv_avg: mcvs.length ? avg(mcvs) : 0,
            mcv_max: mcvs.length ? Math.max(...mcvs) : 0,
            start_ts: this.current_set_start,
            end_ts: now,
            reason
        };
        this.set_history.push(set_summary);
        this.current_set_start = now;
    }
    check_double_clap(lm, now) {
        if (now < this._set_cooldown_until) {
            this._last_close = false;
            return false;
        }
        const lw = [lm[15].x, lm[15].y];
        const rw = [lm[16].x, lm[16].y];
        const lv = lm[15].visibility ?? 0;
        const rv = lm[16].visibility ?? 0;
        const vis_ok = (lv >= this.clap_vis_thresh && rv >= this.clap_vis_thresh);
        const dist = euclid2d(lw, rw);
        this._last_clap_dist = dist;
        const close = vis_ok && (dist <= this.clap_dist_thresh);
        if (!close && this._last_close)
            this._last_far_t = now;
        const rising_ok = (close && !this._last_close &&
            (now - this._last_far_t) >= this.clap_min_open &&
            (now - this._last_clap_t) >= this.clap_min_gap);
        if (rising_ok) {
            if (this._first_clap_t == null) {
                this._first_clap_t = now;
            }
            else {
                if ((now - this._first_clap_t) <= this.clap_window) {
                    this._last_clap_t = now;
                    this._first_clap_t = null;
                    this._last_close = false;
                    this._last_far_t = now;
                    this._set_cooldown_until = now + this.clap_cooldown;
                    return true;
                }
                else {
                    this._first_clap_t = now;
                }
            }
            this._last_clap_t = now;
        }
        this._last_close = close;
        return false;
    }
    compute_metrics(lm) {
        const left_ids = [this.L_SHO, this.L_ELB, this.L_WRI];
        const right_ids = [this.R_SHO, this.R_ELB, this.R_WRI];
        const left_vis = mean(left_ids.map(i => lm[i].visibility ?? 0));
        const right_vis = mean(right_ids.map(i => lm[i].visibility ?? 0));
        const ids = left_vis >= right_vis ? left_ids : right_ids;
        const [s, e, w] = ids;
        const vis_ok = ((lm[s].visibility ?? 0) > 0.5 && (lm[e].visibility ?? 0) > 0.5 && (lm[w].visibility ?? 0) > 0.5);
        const a = [lm[s].x, lm[s].y, lm[s].z];
        const b = [lm[e].x, lm[e].y, lm[e].z];
        const c = [lm[w].x, lm[w].y, lm[w].z];
        const ang = angleBetween(a, b, c);
        const elbow_rel = [lm[e].x - lm[s].x, lm[e].y - lm[s].y];
        return { angle: ang, ids, elbow_rel, vis_ok };
    }
    step(lm, now) {
        if (this.check_double_clap(lm, now)) {
            this.commit_set(now, "double_clap");
            this.sets_completed += 1;
            this.counter.reset_set(now);
            this._first_clap_t = null;
            this._last_close = false;
            this._last_far_t = now;
        }
        const { angle, ids, elbow_rel, vis_ok } = this.compute_metrics(lm);
        const res = this.counter.step(angle, now, elbow_rel, vis_ok);
        return {
            angle,
            reps: res.reps,
            vel: res.vel,
            state: res.state,
            joints: ids,
            pcv_last: res.last_rep_pcv,
            mcv_last: res.last_rep_mcv,
            set_avgs: res.set_avgs,
            setsCompleted: this.sets_completed,
            clapDist: this._last_clap_dist
        };
    }
    endAndSummarize() {
        const now = performance.now() / 1000;
        this.commit_set(now, "quit");
    }
    downloadCSVs() {
        // per-set
        const setFields = ["set", "reps", "pcv_avg", "pcv_max", "mcv_avg", "mcv_max", "start_ts", "end_ts", "reason"];
        const setCsv = toCSV(this.set_history, setFields);
        triggerDownload("session_report.csv", setCsv);
        // per-rep (all session)
        const repFields = ["set", "rep", "pcv", "mcv", "rom", "t_conc", "t_start", "t_peak", "t_end"];
        const repCsv = toCSV(this.rep_history, repFields);
        triggerDownload("reps_report.csv", repCsv);
    }
}
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
function toCSV(rows, fields) {
    const header = fields.join(",");
    const body = rows.map(r => fields.map(f => String(r[f] ?? "")).join(",")).join("\n");
    return header + "\n" + body + "\n";
}
function triggerDownload(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
//# sourceMappingURL=app.js.map