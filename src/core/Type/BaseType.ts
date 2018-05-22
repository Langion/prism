import * as introspector from "@langion/introspector";
import * as _ from "lodash";
import * as types from "../../typings";
import { Type } from "./Type";

export class BaseType<O extends string, E extends string> {
    constructor(protected type: Type<O, E>) {}

    protected getGenerics(desc: types.TypeDesc<O, E>) {
        const generics = _.map(desc.type.generics, (type) => {
            const genericData: types.TypeDesc<O, E> = {
                ...desc,
                type,
                typeLocation: { origin: type.origin, emission: desc.typeLocation.emission },
            };

            const generic = this.type.get(genericData);
            return generic;
        });

        return generics;
    }

    protected getAnotherFilePrefix(desc: types.TypeDesc<O, E>) {
        let prefix = "";

        const isFromAnotherFile = !_.isEqual(desc.requestedFrom, desc.typeLocation);

        const isInternalType = !(
            desc.type.kind === introspector.TypeKind.Entity || desc.type.kind === introspector.TypeKind.Enumeration
        );

        if (isFromAnotherFile && !isInternalType) {
            const connection: types.Connection<O, E> = {
                origin: desc.type.origin,
                emission: desc.typeLocation.emission,
            };

            prefix = this.type.prism.getEmissionName(connection);
            this.type.prism.getEmit(desc.emit, desc.requestedFrom);
            desc.emit[desc.requestedFrom.origin].connections.push(connection);
        }

        return prefix;
    }
}
