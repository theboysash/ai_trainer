import { CurlCounter } from "./curlCounter";
export type StepInfo = {
    angle: number;
    reps: number;
    vel: number;
    state: string;
    joints: number[];
    pcv_last: number | null;
    mcv_last: number | null;
    set_avgs: [number, number] | null;
    setsCompleted: number;
    clapDist: number;
};
export declare class BicepCurlApp {
    L_SHO: number;
    L_ELB: number;
    L_WRI: number;
    R_SHO: number;
    R_ELB: number;
    R_WRI: number;
    counter: CurlCounter;
    clap_dist_thresh: number;
    clap_vis_thresh: number;
    clap_min_gap: number;
    clap_window: number;
    clap_min_open: number;
    clap_cooldown: number;
    _last_close: boolean;
    _last_far_t: number;
    _last_clap_t: number;
    _first_clap_t: number | null;
    _set_cooldown_until: number;
    sets_completed: number;
    set_history: any[];
    current_set_start: number;
    rep_history: any[];
    show_clap_debug: boolean;
    _last_clap_dist: number;
    private drain_rep_history;
    private commit_set;
    private check_double_clap;
    private compute_metrics;
    step(lm: any[], now: number): StepInfo;
    endAndSummarize(): void;
    downloadCSVs(): void;
}
//# sourceMappingURL=app.d.ts.map