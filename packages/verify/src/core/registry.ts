/**
 * ユニットと verifier の中央レジストリ。
 *
 * spec は自分自身をここに登録する。verifier も同様。ハーネスはこのレジストリを通じて
 * すべてを発見する（magic glob もビルド時 codegen もなし）。
 */

import type { VerifiableUnit, Verifier, VerifyManifestEntry } from './types';

const units = new Map<string, VerifiableUnit<unknown>>();
const verifiers = new Map<string, Verifier>();

export function registerUnit<P>(unit: VerifiableUnit<P>): VerifiableUnit<P> {
  // ホットリロード対応: throw せず置き換える。
  if (units.has(unit.id)) units.delete(unit.id);
  // @type-assertion-allowed: レジストリは prop ジェネリクスを消去して保持する。render と fixtures は同一ユニット内で常に整合するため実行時に安全。
  units.set(unit.id, unit as VerifiableUnit<unknown>);
  return unit;
}

export function registerVerifier(verifier: Verifier): Verifier {
  if (verifiers.has(verifier.id)) verifiers.delete(verifier.id);
  verifiers.set(verifier.id, verifier);
  return verifier;
}

export function getUnit(id: string): VerifiableUnit<unknown> | undefined {
  return units.get(id);
}

export function getVerifier(id: string): Verifier | undefined {
  return verifiers.get(id);
}

export function allUnits(): VerifiableUnit<unknown>[] {
  return Array.from(units.values());
}

export function allVerifiers(): Verifier[] {
  return Array.from(verifiers.values());
}

/**
 * ユニットに適用する verifier を解決する（既定で全部、または宣言されたサブセット）。
 * 未知の ID は黙ってスキップ — それが0個になれば runner で BLOCKED として表面化する。
 */
export function verifiersFor(unit: VerifiableUnit<unknown>): Verifier[] {
  if (!unit.verifiers) return allVerifiers();
  return unit.verifiers.map((id) => verifiers.get(id)).filter((v): v is Verifier => Boolean(v));
}

export function buildManifest(): VerifyManifestEntry[] {
  return allUnits().map((u) => ({
    unitId: u.id,
    title: u.title,
    kind: u.kind,
    fixtures: u.fixtures.map((f) => ({
      id: f.id,
      description: f.description,
      probe: Boolean(f.probe),
    })),
    verifiers: verifiersFor(u).map((v) => v.id),
    invariants: u.invariants.map((i) => ({
      id: i.id,
      description: i.description,
    })),
    route: (fixtureId: string) =>
      `/verify/${encodeURIComponent(u.id)}/${encodeURIComponent(fixtureId)}`,
  }));
}
