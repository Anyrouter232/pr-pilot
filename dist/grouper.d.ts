import { PRFile, FileGroup } from './types';
export declare function groupFiles(files: PRFile[]): FileGroup[];
export declare function detectImportRelationships(files: PRFile[]): Map<string, string[]>;
export declare function isTestFile(filename: string): boolean;
