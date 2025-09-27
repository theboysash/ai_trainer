export declare function angleBetween(a: number[], b: number[], c: number[]): number;
export declare const euclid2d: (p: [number, number], q: [number, number]) => number;
export type StepResult = {
    reps: number;
    vel: number;
    state: string;
    last_rep_pcv: number | null;
    last_rep_mcv: number | null;
    set_avgs: [number, number] | null;
};
export declare class CurlCounter {
    up_thresh: number;
    down_thresh: number;
    elbow_disp_thresh: number;
    min_concentric_time: number;
    min_delta_angle: number;
    state: "idle" | "going" | "peak" | "returning";
    reps: number;
    last_angle?: number;
    last_t?: number;
    velocity: number;
    _start_time?: number | null;
    _t_peak?: number | null;
    _start_angle?: number | null;
    _min_angle?: number | null;
    _start_elbow_rel?: [number, number] | null;
    _max_elbow_disp: number;
    _pcv: number;
    _conc_sum: number;
    _conc_time: number;
    pcv_list: number[];
    mcv_list: number[];
    last_rep_pcv: number | null;
    last_rep_mcv: number | null;
    set_index: number;
    _flash_until: number;
    rep_history: any[];
    reset_set(now?: number): void;
    should_flash_banner(nowSec: number): boolean;
    step(angle: number, nowSec: number, elbow_rel?: [number, number] | null, visible?: boolean): StepResult;
}
//# sourceMappingURL=curlCounter.d.ts.map