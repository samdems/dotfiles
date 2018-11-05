export interface LogWriter {
    error(msg: string): any;
    warn(msg: string): any;
    info(msg: string): any;
}
export declare namespace Log {
    var writer: LogWriter;
    function error(msg: string): void;
    function warn(msg: string): void;
    function info(msg: string): void;
}
