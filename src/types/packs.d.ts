import { BaseLevel } from './levels';

export type Pack = {
    id: string;
    name: string;
    points: number;
    levels: BaseLevel[];
};

export type BasePackTier = {
    id: string;
    name: string;
    color: string;
};

export type PackTier = BasePackTier & {
    placement: number;
    packs: Pack[];
};

export interface LevelPack {
    id: string;
    name: string;
    tier: BasePackTier;
}
