import * as introspector from "@langion/introspector";
import * as types from "../../typings";
import { BaseType } from "./BaseType";
import { Type } from "./Type";

export class TypeScriptType<O extends string, E extends string> extends BaseType<O, E> {
    constructor(private desc: types.TypeScriptTypeGetter<O, E>, type: Type<O, E>) {
        super(type);
    }

    public get() {
        let name = this.mapType(this.desc.type.kind);

        if (name) {
            return name;
        }

        name = this.desc.type.name;
        const generics = this.getGenerics(this.desc);
        const isMap = this.desc.type.kind === introspector.TypeKind.Map;

        if (this.desc.type.kind === introspector.TypeKind.List) {
            name = "Array";
        } else if (isMap) {
            name = "Record";
        } else if (this.desc.type.kind === introspector.TypeKind.TypeParameter) {
            return name;
        }

        const prefix = this.getAnotherFilePrefix(this.desc);

        if (prefix) {
            name = `${prefix}.${name}`;
        }

        if (generics.length) {
            const line = isMap ? `string,${generics[1]}` : generics.join();
            name = `${name}<${line}>`;
        }

        return name;
    }

    private mapType(kind: introspector.TypeKind) {
        switch (kind) {
            case introspector.TypeKind.Boolean:
                return "boolean";
            case introspector.TypeKind.Date:
                return "Date";
            case introspector.TypeKind.Number:
                return "number";
            case introspector.TypeKind.String:
                return "string";
            case introspector.TypeKind.Object:
                return "{}";
            case introspector.TypeKind.Void:
                return "void";
            default:
                return "";
        }
    }
}
