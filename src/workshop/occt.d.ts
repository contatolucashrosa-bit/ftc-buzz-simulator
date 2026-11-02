// Tipos mínimos do occt-import-js (o pacote não traz declarações).
declare module "occt-import-js" {
  interface OcctMesh {
    name: string;
    color?: [number, number, number];
    attributes: { position: { array: number[] }; normal?: { array: number[] } };
    index: { array: number[] };
  }
  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }
  interface Occt {
    ReadStepFile(content: Uint8Array, params: Record<string, unknown> | null): OcctResult;
  }
  export default function occtimportjs(options?: { locateFile?: (path: string) => string }): Promise<Occt>;
}
