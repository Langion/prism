import { Prism } from "../../Prism";
import * as types from "../../typings";
import { GraphQLType } from "./GraphQLType";
import { TypeScriptType } from "./TypeScriptType";

export class Type<O extends string, E extends string> {
    constructor(public prism: Prism<O, E>) {}

    public get(desc: types.TypeDesc<O, E>) {
        switch (desc.kind) {
            case "GraphQL":
                return this.getAsGrapqhQL(desc);
            case "TypeScript":
                return this.getAsTypeScript(desc);
            default:
                const unknown = JSON.stringify(desc, undefined, 4);
                throw new Error(`There is no Type ${unknown}`);
        }
    }

    private getAsGrapqhQL(desc: types.GraphQLTypeGetter<O, E>) {
        const type: GraphQLType<O, E> = new GraphQLType<O, E>(desc, this);
        const result = type.get();
        return result;
    }

    private getAsTypeScript(desc: types.TypeScriptTypeGetter<O, E>) {
        const type: TypeScriptType<O, E> = new TypeScriptType<O, E>(desc, this);
        const result = type.get();
        return result;
    }
}
