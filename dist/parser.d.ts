import { PRFile } from './types';
export declare function buildAnnotatedDiff(file: PRFile): string;
export declare function isLineInDiff(file: PRFile, line: number): boolean;
