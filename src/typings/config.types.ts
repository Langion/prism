import * as introspector from "@langion/introspector";
import * as prettier from "prettier";
import { Emitter } from "../core/Emitter";
import { Prism } from "../Prism";
import { Context } from "./Prism.types";

export interface EmitArgs<O extends string, E extends string> {
    prism: Prism<O, E>;
    introspections: Record<O, introspector.Introspection<O>>;
}

export interface ApiraApiArgs<O extends string, E extends string> extends EmitArgs<O, E> {
    apiAbsolutePath: string;
}

export interface TSLintConfig {
    enabled: boolean;
    tslintConfigAbsolutePath: string;
    addTsIgnore: boolean;
}

export interface PrismConfig<O extends string, E extends string> {
    outFolderAbsolutePath: string;
    introspections: Record<O, introspector.Introspection<O>>;
    emitters: Array<(args: EmitArgs<O, E>) => Emitter<O, E, Context<O, E>>>;
    unknown: introspector.SideOrigin<O>;
    shared: introspector.SideOrigin<O>;
    tslint: TSLintConfig;
    prettier?: prettier.Options;
}
