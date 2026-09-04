import { describe, expect, it } from 'vitest';
import {
  bubbleCount,
  bubbleSpeed,
  CORK,
  EDGES_THRESHOLD_DEG,
  hazeOpacity,
  hazeVisible,
  hazeY,
  JAR_HEIGHT,
  jarRadiusAt,
  liquidLevel,
  MAX_WORDS,
  MERIDIAN_COUNT,
  MERIDIAN_OPACITY,
  MIN_WORD_GAP,
  outlineOpacity,
  placeWords,
  SEAL_BASE_Y,
  sampleJarProfile,
  sealFloat,
  silhouetteBufferSize,
  solveJarSilhouette,
  WORD_BOB_AMPLITUDE,
  WORD_ORBIT_RADIUS,
  WORD_SPRITE_HEIGHT,
  wordScale,
} from '@/features/shared/study/scene/jar';

const PROFILE = sampleJarProfile();

describe('sampleJarProfile', () => {
  it('母線を細かく標本化する（粗いと胴に横線が浮く）', () => {
    // 制御点 16 個 × 5 分割 + 口縁 4 点。80 点前後の滑らかな母線になる。
    expect(PROFILE.length).toBeGreaterThan(70);
    expect(PROFILE.length).toBeLessThan(90);
  });

  it('底から口縁まで単調に上がる', () => {
    for (let i = 1; i < PROFILE.length; i++) {
      expect(PROFILE[i].y).toBeGreaterThanOrEqual(PROFILE[i - 1].y - 1e-9);
    }
  });

  it('半径が負にならない', () => {
    for (const point of PROFILE) expect(point.x).toBeGreaterThanOrEqual(0);
  });

  it('底が y=0 を割らない（Catmull-Rom の張り出しを均している）', () => {
    // 制御点が [0,0] [0.35,0] と y の並ぶ区間で、補間曲線はわずかに下へ膨らむ。
    // 均さないと母線が単調でなくなり、jarRadiusAt の補間が底で崩れる。
    for (const point of PROFILE) expect(point.y).toBeGreaterThanOrEqual(0);
  });

  it('全高が 2.94、最大半径が 1.30 前後', () => {
    expect(PROFILE[PROFILE.length - 1].y).toBeCloseTo(JAR_HEIGHT, 5);
    const maxRadius = Math.max(...PROFILE.map((p) => p.x));
    expect(maxRadius).toBeGreaterThan(1.25);
    expect(maxRadius).toBeLessThan(1.35);
  });

  it('口が胴より細い（ゴミ箱と読み違えられない形）', () => {
    const maxRadius = Math.max(...PROFILE.map((p) => p.x));
    // 口縁の半径は 1.0。胴の 1.30 よりはっきり細い。
    const rimRadius = 1.0;
    expect(rimRadius).toBeLessThan(maxRadius * 0.85);
  });

  it('首がくびれてから口縁で開く', () => {
    const neck = jarRadiusAt(PROFILE, 2.62);
    const rim = jarRadiusAt(PROFILE, 2.9);
    expect(neck).toBeLessThan(rim);
    expect(neck).toBeCloseTo(0.9, 1);
  });
});

describe('jarRadiusAt', () => {
  it('母線の範囲外は端の値に張り付く', () => {
    expect(jarRadiusAt(PROFILE, -1)).toBe(PROFILE[0].x);
    expect(jarRadiusAt(PROFILE, 99)).toBe(PROFILE[PROFILE.length - 1].x);
  });

  it('空の母線でも落ちない', () => {
    expect(jarRadiusAt([], 1)).toBe(0);
  });

  it('胴のあたりで最大半径に近づく', () => {
    expect(jarRadiusAt(PROFILE, 1.12)).toBeGreaterThan(1.25);
  });
});

describe('liquidLevel', () => {
  it('readiness 0 でも底に少し残る', () => {
    expect(liquidLevel(0)).toBeCloseTo(0.35, 5);
  });

  it('readiness 1 で 2.2（口縁 2.94 を超えない）', () => {
    expect(liquidLevel(1)).toBeCloseTo(2.2, 5);
    expect(liquidLevel(1)).toBeLessThan(JAR_HEIGHT);
  });

  it('readiness に対して単調に上がる', () => {
    expect(liquidLevel(0.5)).toBeGreaterThan(liquidLevel(0.2));
  });

  it('範囲外の readiness を丸める', () => {
    expect(liquidLevel(-1)).toBe(liquidLevel(0));
    expect(liquidLevel(2)).toBe(liquidLevel(1));
  });
});

describe('bubbleCount / bubbleSpeed', () => {
  it('readiness が上がるほど泡が増える', () => {
    expect(bubbleCount(0, false)).toBe(4);
    expect(bubbleCount(1, false)).toBe(30);
    expect(bubbleCount(0.5, false)).toBeGreaterThan(bubbleCount(0.2, false));
  });

  it('完了すると泡が最小になり、速度が 0 になる（静かになる）', () => {
    expect(bubbleCount(1, true)).toBe(4);
    expect(bubbleSpeed(1, true, 0.5)).toBe(0);
  });

  it('発酵中は必ず上へ動く', () => {
    for (const random of [0, 0.5, 1]) {
      expect(bubbleSpeed(0.3, false, random)).toBeGreaterThan(0);
    }
  });

  it('readiness が上がるほど速い', () => {
    expect(bubbleSpeed(1, false, 0.5)).toBeGreaterThan(bubbleSpeed(0.1, false, 0.5));
  });
});

describe('もやと輪郭の呼吸', () => {
  it('readiness が低いうちはもやを出さない', () => {
    expect(hazeVisible(0)).toBe(false);
    expect(hazeVisible(0.2)).toBe(false);
    expect(hazeVisible(0.21)).toBe(true);
  });

  it('もやの濃さが readiness で増える', () => {
    expect(hazeOpacity(1)).toBeGreaterThan(hazeOpacity(0.3));
    expect(hazeOpacity(1)).toBeLessThanOrEqual(1);
  });

  it('もやが口から溢れない', () => {
    expect(hazeY(liquidLevel(1))).toBeLessThanOrEqual(2.6);
    expect(hazeY(liquidLevel(1))).toBeLessThan(JAR_HEIGHT);
  });

  it('readiness 0 の輪郭は呼吸しない（静かな瓶）', () => {
    const samples = [0, 0.25, 0.5, 0.75].map((phase) => outlineOpacity(0, phase));
    for (const opacity of samples) expect(opacity).toBeCloseTo(1, 10);
  });

  it('readiness が高いほど呼吸の振れ幅が大きい', () => {
    const swing = (readiness: number) => {
      const values = Array.from({ length: 40 }, (_, i) => outlineOpacity(readiness, i / 40));
      return Math.max(...values) - Math.min(...values);
    };
    expect(swing(1)).toBeGreaterThan(swing(0.3));
  });

  it('輪郭が消えるほど薄くならない', () => {
    for (let i = 0; i < 40; i++) {
      expect(outlineOpacity(1, i / 40)).toBeGreaterThan(0.6);
    }
  });
});

describe('placeWords', () => {
  const WORDS = ['発酵', '沈黙', '手触り', '余白', '記憶', '輪郭', 'あふれ'];

  it('最大 6 語まで（それ以上は出さない）', () => {
    const placements = placeWords(WORDS, liquidLevel(1));
    expect(placements.length).toBeLessThanOrEqual(MAX_WORDS);
  });

  it.each([0, 0.1, 0.3, 0.5, 0.7, 0.9, 1])('readiness %s でも語が重ならない', (readiness) => {
    // 語ごとに大きさが違うので、行間は**隣り合う 2 語の高さ**から決まる。
    // 一律の間隔で見ると、大きい語どうしが触れているのを見逃す。
    const placements = placeWords(WORDS, liquidLevel(readiness));
    for (let i = 1; i < placements.length; i++) {
      const gap = placements[i].y - placements[i - 1].y;
      const touching =
        (WORD_SPRITE_HEIGHT * placements[i - 1].scale + WORD_SPRITE_HEIGHT * placements[i].scale) /
        2;
      expect(gap).toBeGreaterThanOrEqual(touching - 1e-9);
    }
  });

  it('語ごとに大きさが変わる（全語が同じ大きさにならない）', () => {
    const scales = placeWords(WORDS, liquidLevel(1)).map((p) => p.scale);
    expect(new Set(scales).size).toBeGreaterThan(1);
  });

  it('同じ語は常に同じ大きさ（組み直しでちらつかない）', () => {
    // Math.random() で決めると、状態が更新されるたびに大きさが変わって画面が騒がしくなる。
    expect(wordScale('発酵')).toBe(wordScale('発酵'));
    expect(wordScale('発酵')).not.toBe(wordScale('沈黙'));
  });

  it('問いごとのキーワードを全部並べられる', () => {
    const many = ['あ', 'いい', 'ううう', 'ええ', 'おおお', 'かか', 'きき', 'くく'];
    // 行間を詰めてでも全部出す（入り切らない語だけを落とす）。
    expect(placeWords(many, liquidLevel(1)).length).toBeGreaterThanOrEqual(6);
  });

  it('揺れを足しても隣の語に触れない', () => {
    // 上下 ±0.045 の揺れは行間より十分小さくないと意味がない。
    expect(WORD_BOB_AMPLITUDE * 2).toBeLessThan(MIN_WORD_GAP);
  });

  it('readiness が低いほど表示語数が減る（発酵が浅い＝語も少ない）', () => {
    const shallow = placeWords(WORDS, liquidLevel(0.1)).length;
    const deep = placeWords(WORDS, liquidLevel(1)).length;
    expect(shallow).toBeLessThan(deep);
  });

  it('液面を突き抜けない', () => {
    for (const readiness of [0.2, 0.6, 1]) {
      const level = liquidLevel(readiness);
      for (const placement of placeWords(WORDS, level)) {
        expect(placement.y).toBeLessThan(level);
      }
    }
  });

  it('1 語だけなら範囲の中ほどに置く（底に貼り付かない）', () => {
    const placements = placeWords(['発酵'], liquidLevel(1));
    expect(placements).toHaveLength(1);
    expect(placements[0].y).toBeGreaterThan(0.3);
  });

  it('語が無ければ空', () => {
    expect(placeWords([], liquidLevel(1))).toEqual([]);
  });

  it('液面が低くても必ず 1 語は出す（言葉が漂う見せ方そのものを消さない）', () => {
    // readiness が低いほど語が減るのは意図どおりだが、0 語になると瓶がただの容器に見える。
    for (const readiness of [0, 0.05, 0.2]) {
      expect(placeWords(WORDS, liquidLevel(readiness)).length).toBeGreaterThanOrEqual(1);
    }
    expect(placeWords(WORDS, 0).length).toBeGreaterThanOrEqual(1);
  });

  it('液面が低すぎても落ちない', () => {
    expect(() => placeWords(WORDS, 0)).not.toThrow();
  });

  it('方位を黄金角でずらす（少ない語数でも重ならずに散る）', () => {
    const placements = placeWords(WORDS, liquidLevel(1));
    for (let i = 1; i < placements.length; i++) {
      expect(placements[i].angle - placements[i - 1].angle).toBeCloseTo(2.39996, 5);
    }
  });

  it('渡した順に並ぶ（語が入れ替わらない）', () => {
    const placements = placeWords(WORDS, liquidLevel(1));
    expect(placements.map((p) => p.word)).toEqual(WORDS.slice(0, placements.length));
  });
});

describe('solveJarSilhouette', () => {
  const CAMERA = { horizontalDistance: 12, azimuth: 0, y: 4 };

  it('輪郭が閉じた一周になる', () => {
    const loop = solveJarSilhouette(PROFILE, CAMERA);
    expect(loop.length).toBeGreaterThan(20);
  });

  it('上から下まで解が残る（下半分だけ消えない）', () => {
    // 近似（母線をカメラ方位へ向ける）で消えていたのが下半分。ここが本丸。
    const loop = solveJarSilhouette(PROFILE, CAMERA);
    const ys = loop.map((p) => p.y);
    expect(Math.min(...ys)).toBeLessThan(0.3);
    expect(Math.max(...ys)).toBeGreaterThan(2.5);
  });

  it('高さの分布が上下で偏らない（濃さが片側に寄らない）', () => {
    const loop = solveJarSilhouette(PROFILE, CAMERA);
    const mid = JAR_HEIGHT / 2;
    const lower = loop.filter((p) => p.y < mid).length;
    const upper = loop.filter((p) => p.y >= mid).length;
    // どちらかが極端に少ないと、その側の線だけ薄く見える。
    expect(Math.min(lower, upper)).toBeGreaterThan(loop.length * 0.2);
  });

  it('左右の枝が方位の両側に分かれる', () => {
    const loop = solveJarSilhouette(PROFILE, { ...CAMERA, azimuth: 0 });
    expect(loop.some((p) => p.angle > 0)).toBe(true);
    expect(loop.some((p) => p.angle < 0)).toBe(true);
  });

  it('カメラ方位を回すと輪郭も一緒に回る', () => {
    const straight = solveJarSilhouette(PROFILE, { ...CAMERA, azimuth: 0 });
    const turned = solveJarSilhouette(PROFILE, { ...CAMERA, azimuth: Math.PI / 2 });
    const meanAngle = (points: { angle: number }[]) =>
      points.reduce((sum, p) => sum + p.angle, 0) / points.length;
    expect(meanAngle(turned) - meanAngle(straight)).toBeCloseTo(Math.PI / 2, 3);
  });

  it.each([2, 6, 12, 30])('距離 %s でも輪郭が途切れない', (distance) => {
    const loop = solveJarSilhouette(PROFILE, { ...CAMERA, horizontalDistance: distance });
    expect(loop.length).toBeGreaterThan(20);
    const ys = loop.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });

  it.each([-2, 0, 4, 10])('カメラ高さ %s でも輪郭が途切れない', (y) => {
    const loop = solveJarSilhouette(PROFILE, { ...CAMERA, y });
    expect(loop.length).toBeGreaterThan(20);
  });

  it('半径がすべて母線の範囲に収まる', () => {
    const maxRadius = Math.max(...PROFILE.map((p) => p.x));
    for (const point of solveJarSilhouette(PROFILE, CAMERA)) {
      expect(point.radius).toBeGreaterThanOrEqual(0);
      expect(point.radius).toBeLessThanOrEqual(maxRadius + 1e-9);
    }
  });

  it('NaN を出さない', () => {
    for (const point of solveJarSilhouette(PROFILE, CAMERA)) {
      expect(Number.isFinite(point.angle)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(point.radius)).toBe(true);
    }
  });

  it('母線が空なら空を返す', () => {
    expect(solveJarSilhouette([], CAMERA)).toEqual([]);
  });

  it('確保する頂点数が実際の点数を必ず上回る', () => {
    // 毎フレーム解き直すので、バッファは一度だけ確保して setDrawRange で使う。
    const loop = solveJarSilhouette(PROFILE, CAMERA);
    expect(silhouetteBufferSize(PROFILE.length)).toBeGreaterThanOrEqual(loop.length);
  });
});

describe('横線を立てないための設定', () => {
  it('EdgesGeometry のしきい値が既定の 15° より大きい', () => {
    // 既定のままだと滑らかな胴にも稜線が出て、底・胴・首に横線が走る。
    expect(EDGES_THRESHOLD_DEG).toBeGreaterThan(15);
  });

  it('しきい値が 90° 未満（口縁とコルクの稜線は残す）', () => {
    // 上げすぎると口の形を決めている角まで消え、瓶が筒に見える。
    expect(EDGES_THRESHOLD_DEG).toBeLessThan(90);
  });

  it('経線は 8 本、緯線は置かない', () => {
    // 緯線リングを置くと、しきい値でせっかく消した横線を自分で描き足すことになる。
    expect(MERIDIAN_COUNT).toBe(8);
    expect(MERIDIAN_OPACITY).toBeGreaterThan(0);
    expect(MERIDIAN_OPACITY).toBeLessThan(0.3);
  });
});

describe('言葉の寸法', () => {
  it('行間の下限がスプライト高さの 1.7 倍', () => {
    expect(MIN_WORD_GAP).toBeCloseTo(WORD_SPRITE_HEIGHT * 1.7, 10);
  });

  it('周回半径が胴の内径より小さい（壁を突き抜けない）', () => {
    // 胴の最大半径は 1.30。周回してもガラスの内側に収まること。
    expect(WORD_ORBIT_RADIUS).toBeLessThan(0.9);
    expect(WORD_ORBIT_RADIUS).toBeGreaterThan(0);
  });
});

describe('コルクと封', () => {
  it('封が瓶の口より上に浮く', () => {
    expect(SEAL_BASE_Y).toBeGreaterThan(JAR_HEIGHT);
  });

  it('封の揺れが浮遊高さに対して十分小さい（飛んでいるように見えない）', () => {
    const swing = Math.max(...Array.from({ length: 60 }, (_, i) => sealFloat(i * 0.2).yOffset));
    expect(swing).toBeLessThan(SEAL_BASE_Y * 0.05);
  });

  it('コルクが口縁に少し沈む', () => {
    // 口縁は 2.94。コルクの中心が 2.99 で高さ 0.38 なので、下端は口の中に入る。
    expect(CORK.y - CORK.height / 2).toBeLessThan(JAR_HEIGHT);
  });

  it('コルクが口に収まる（上が下より広い＝抜けない形）', () => {
    expect(CORK.radiusTop).toBeGreaterThan(CORK.radiusBottom);
    // 口縁の内径 1.0 に対して、下側が入る太さであること。
    expect(CORK.radiusBottom).toBeLessThan(1.0);
  });

  it('封が上下に揺れ、微小に回る', () => {
    const at0 = sealFloat(0);
    expect(at0.yOffset).toBeCloseTo(0, 10);
    expect(at0.rotationZ).toBeCloseTo(0, 10);

    const samples = Array.from({ length: 60 }, (_, i) => sealFloat(i * 0.2));
    const ys = samples.map((s) => s.yOffset);
    expect(Math.max(...ys)).toBeGreaterThan(0.05);
    expect(Math.min(...ys)).toBeLessThan(-0.05);
    // 回転は「微小」であること（回りすぎると封に見えない）。
    for (const sample of samples) expect(Math.abs(sample.rotationZ)).toBeLessThanOrEqual(0.04);
  });
});
