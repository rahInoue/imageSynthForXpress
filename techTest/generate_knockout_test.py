#!/usr/bin/env python3
"""
Knockout処理の検証用スクリプト

3種類のknockout処理パターンを比較検証するためのテスト画像を生成:
1. binary: 完全2値化（従来方式）- α > threshold で黒、それ以外は透明
2. gradient: αの値に応じたグラデーション - 非透過は黒、半透明は中間グレー
3. steep_gradient: 傾斜付きグラデーション - α値がちょっとでもあればより強く黒に寄せる

test.jsonの6件 × 3パターン = 18枚を1シートに出力
char_knockレイヤーには各カードごとに指定されたパターンのknockoutを適用
"""

import sys
import os
import json
from pathlib import Path

# 親ディレクトリをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from typing import List, Dict, Tuple

# index.pyから必要な関数とパラメータをインポート
from index import (
    DPI, CARD_PX, CUTLINE_MM, MARGIN_MM, SPACING_MM,
    mm_to_px, resize_char_canvas, resize_bg_canvas,
    KNOCKOUT_THRESHOLD, KNOCKOUT_MIN_ALPHA, KNOCKOUT_SHRINK_MM,
    CUTLINE_PX, MARGIN_PX, SPACING_PX
)

# knockout処理のパターン定義
KNOCKOUT_PATTERNS = ["binary", "gradient", "steep"]


def apply_knockout(alpha: Image.Image, pattern: str, threshold: int = KNOCKOUT_THRESHOLD) -> Image.Image:
    """
    パターンに応じたknockout処理を適用

    Args:
        alpha: キャラクター画像のアルファチャンネル
        pattern: "binary", "gradient", "steep" のいずれか
        threshold: 閾値（デフォルト: KNOCKOUT_THRESHOLD=20）

    Returns:
        処理済みのアルファチャンネル（白板用マスク）
    """
    if pattern == "binary":
        # パターン1: 完全2値化
        # α > threshold → 255 (黒/不透明)
        # α <= threshold → 0 (透明)
        return alpha.point(lambda p: 0 if p < threshold else 255)

    elif pattern == "gradient":
        # パターン2: αの値に応じたグラデーション
        # α > threshold → そのままのα値を使用
        # α <= threshold → 0 (透明)
        # 非透過(α=255)は完全黒、半透明(α=128)は中間グレー
        return alpha.point(lambda p: 0 if p < threshold else p)

    elif pattern == "steep":
        # パターン3: 傾斜付きグラデーション
        # α値がちょっとでもあれば、より強く黒に寄せる
        # 累乗関数: output = ((α - threshold) / (255 - threshold)) ^ (1/steepness) * 255
        steepness = 2.5  # この値が大きいほど、低αでも黒くなる

        def steep_func(p):
            if p < threshold:
                return 0
            normalized = (p - threshold) / (255 - threshold)
            steeper = pow(normalized, 1.0 / steepness)
            return int(min(255, steeper * 255))

        return alpha.point(steep_func)

    else:
        raise ValueError(f"Unknown knockout pattern: {pattern}")


def grid_layout_for_test(
    sheet_px: Tuple[int, int],
    card_px: Tuple[int, int] = CARD_PX,
    margin_px: int = MARGIN_PX,
    spacing_px: int = SPACING_PX,
    border_px: int = CUTLINE_PX,
    left_margin_px: int = None,
):
    """テスト用のグリッドレイアウト計算"""
    fw, fh = card_px[0] + border_px * 2, card_px[1] + border_px * 2

    right_margin_px = margin_px
    if left_margin_px is None:
        left_margin_px = margin_px

    usable_w = sheet_px[0] - left_margin_px - right_margin_px
    usable_h = sheet_px[1] - margin_px * 2

    cols = max(1, (usable_w + spacing_px) // (fw + spacing_px))
    rows = max(1, (usable_h + spacing_px) // (fh + spacing_px))

    positions = []
    for r in range(int(rows)):
        for c in range(int(cols)):
            x = left_margin_px + c * (fw + spacing_px) + border_px
            y = margin_px + r * (fh + spacing_px) + border_px
            positions.append((x, y))
    return positions, rows, cols


def load_test_data(json_path: str) -> List[Dict]:
    """
    test.jsonを読み込んで、3パターン分に展開

    6件 × 3パターン = 18件のカードデータを生成
    """
    with open(json_path, 'r') as f:
        data = json.load(f)

    result = []
    for item in data:
        # 各アイテムを3パターン分に展開
        for pattern in KNOCKOUT_PATTERNS:
            result.append({
                "key": f"{item['orderId']}_{item['shouhinId']}",
                "char": item["shouhinNaiyou"],
                "bg": item.get("bgFlg"),  # nullの場合あり
                "logo": item.get("logoPath"),
                "orderId": str(item["orderId"]),
                "userName": f"{item['orderId']}_{item['shouhinId']}",
                "amount": 1,
                "knockout_pattern": pattern,  # knockoutパターンを指定
                "has_bg": item.get("bgFlg") is not None,
            })

    return result


def generate_test_sheet(
    test_data: List[Dict],
    sheet_mm: Tuple[float, float],
    output_dir: str,
):
    """
    knockoutパターンを個別に適用したテストシートを生成

    各カードは指定されたknockout_patternに応じて処理される
    char_knockレイヤーには各カードごとに異なるパターンが適用される
    """
    # シート寸法計算
    sheet_px = (mm_to_px(sheet_mm[0]), mm_to_px(sheet_mm[1]))

    # ラベル用の追加マージン
    label_margin_mm = 50
    label_margin_px = mm_to_px(label_margin_mm)
    left_margin_px = MARGIN_PX + label_margin_px

    print(f"シート寸法(mm): {sheet_mm[0]} x {sheet_mm[1]}")
    print(f"シート寸法(px): {sheet_px[0]} x {sheet_px[1]}")

    # レイアウト計算
    positions, rows, cols = grid_layout_for_test(
        sheet_px=sheet_px,
        left_margin_px=left_margin_px
    )

    print(f"レイアウト: {cols}列 x {rows}行 = 最大{len(positions)}枚")
    print(f"テストデータ: {len(test_data)}枚")

    if len(test_data) > len(positions):
        raise ValueError(f"シートに入りきりません: {len(test_data)}枚 > {len(positions)}枚")

    # レイヤー初期化（通常の構成）
    layers = {
        "cutline": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "glare": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "logos": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "logo_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "character": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "char_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),  # 各カードごとにパターンが異なる
        "bg_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "background": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "labels": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
    }

    draw_cut = ImageDraw.Draw(layers["cutline"])

    # フォント設定
    try:
        font_size = 60
        font = None

        japanese_fonts = [
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/STHeiti Light.ttc",
        ]

        for font_path in japanese_fonts:
            try:
                font = ImageFont.truetype(font_path, font_size, index=0)
                break
            except:
                continue

        if font is None:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)

    except:
        font = ImageFont.load_default()

    # 収縮処理用のパラメータ
    shrink_px = max(0, mm_to_px(KNOCKOUT_SHRINK_MM))

    # カードごとに処理
    for card, (x, y) in zip(test_data, positions):
        pattern = card["knockout_pattern"]
        has_bg = card["has_bg"]

        print(f"処理中: {card['key']} | pattern={pattern} | bg={'あり' if has_bg else 'なし'}")

        # 画像読み込み
        try:
            char_img_raw = Image.open(card["char"]).convert("RGBA")
        except Exception as e:
            print(f"  Error loading char: {e}")
            continue

        char_img = resize_char_canvas(char_img_raw, CARD_PX, allow_upscale=False)

        # 背景読み込み
        bg_img = None
        if card.get("bg"):
            try:
                bg_img_raw = Image.open(card["bg"]).convert("RGBA")
                bg_img = resize_bg_canvas(bg_img_raw, CARD_PX, allow_upscale=True)
            except Exception as e:
                print(f"  Error loading bg: {e}")

        if bg_img is None:
            bg_img = Image.new("RGBA", CARD_PX, (0, 0, 0, 0))

        # ロゴ読み込み
        logo_img = None
        if card.get("logo"):
            try:
                logo_img_raw = Image.open(card["logo"]).convert("RGBA")
                logo_img = resize_char_canvas(logo_img_raw, CARD_PX, allow_upscale=True)
            except Exception as e:
                print(f"  Error loading logo: {e}")

        # レイヤーに配置
        layers["character"].paste(char_img, (x, y), char_img)
        layers["background"].paste(bg_img, (x, y), bg_img)

        # glare layer
        alpha = char_img.split()[-1]
        black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["glare"].paste(black, (x, y), alpha)

        # ロゴレイヤー
        if logo_img:
            layers["logos"].paste(logo_img, (x, y), logo_img)

            # ロゴknockout (2値化)
            logo_alpha = logo_img.split()[-1]
            logo_knock = apply_knockout(logo_alpha, "binary")
            if shrink_px > 0:
                logo_knock_smooth = logo_knock.filter(ImageFilter.GaussianBlur(radius=0.3))
                logo_knock = logo_knock_smooth.filter(ImageFilter.MinFilter(3))
            layers["logo_knock"].paste(black, (x, y), logo_knock)

        # 背景knockout
        if card.get("bg"):
            bg_mask = Image.new("L", CARD_PX, 255)
            black_bg = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
            layers["bg_knock"].paste(black_bg, (x, y), bg_mask)

        # character knockout - パターンに応じた処理を適用
        alpha = char_img.split()[-1]
        knock = apply_knockout(alpha, pattern)

        if shrink_px > 0:
            knock_smooth = knock.filter(ImageFilter.GaussianBlur(radius=0.3))
            knock = knock_smooth.filter(ImageFilter.MinFilter(3))

        # グラデーション系の場合はアルファ合成
        if pattern in ["gradient", "steep"]:
            knock_layer = Image.new("RGBA", CARD_PX, (0, 0, 0, 0))
            knock_layer.paste(Image.new("RGB", CARD_PX, (0, 0, 0)), (0, 0), knock)
            layers["char_knock"].alpha_composite(knock_layer, (x, y))
        else:
            # binary の場合は従来通り
            black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
            layers["char_knock"].paste(black, (x, y), knock)

        # カットライン
        bx1 = x - CUTLINE_PX
        by1 = y - CUTLINE_PX
        bx2 = x + CARD_PX[0] + CUTLINE_PX - 1
        by2 = y + CARD_PX[1] + CUTLINE_PX - 1
        draw_cut.rectangle(
            [(bx1, by1), (bx2, by2)], outline=(0, 0, 0, 255), width=CUTLINE_PX
        )

        # ラベル描画（パターン名と背景有無を表示）
        bg_label = "bg" if has_bg else "no-bg"
        label_text = f"{pattern}\n{bg_label}"

        text_img = Image.new("RGBA", (CARD_PX[1], 350), (0, 0, 0, 0))
        text_draw = ImageDraw.Draw(text_img)

        try:
            # 2行テキストを描画
            lines = label_text.split("\n")
            y_offset = 80
            for line in lines:
                bbox = text_draw.textbbox((0, 0), line, font=font)
                w = bbox[2] - bbox[0]
                text_x = (text_img.width - w) // 2
                text_draw.text((text_x, y_offset), line, fill=(0, 0, 0, 255), font=font)
                y_offset += 80
        except:
            text_draw.text((20, 150), label_text, fill=(0, 0, 0, 255), font=font)

        rotated_text = text_img.rotate(90, expand=True)

        label_margin = mm_to_px(5)
        text_width = rotated_text.width
        text_height = rotated_text.height

        label_right_shift = 180
        text_x = bx1 - label_margin - text_width + label_right_shift
        if text_x < 10:
            text_x = 10
        text_y = by1 + (by2 - by1) // 2 - text_height // 2

        layers["labels"].paste(rotated_text, (text_x, text_y), rotated_text)

    # 出力ディレクトリ作成
    os.makedirs(output_dir, exist_ok=True)

    # PNG出力
    for name, img in layers.items():
        # ロゴレイヤーは存在する場合のみ保存
        if name in ["logos", "logo_knock"]:
            has_logo = any(card.get("logo") for card in test_data)
            if not has_logo:
                continue

        path = os.path.join(output_dir, f"sheet_{name}.png")
        img.save(path, dpi=(DPI, DPI))
        print(f"Saved: {path}")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Knockout処理の検証用テスト画像を生成"
    )
    parser.add_argument(
        "--input", "-i",
        default="techTest/test.json",
        help="入力JSONファイルパス"
    )
    parser.add_argument(
        "--sheet", "-s",
        default="280x580",
        help="シート寸法 (例: 280x580)"
    )
    parser.add_argument(
        "--output", "-o",
        default="techTest/output",
        help="出力ディレクトリ"
    )

    args = parser.parse_args()

    # シート寸法パース
    try:
        w_mm, h_mm = map(float, args.sheet.lower().split("x"))
    except:
        print("シート寸法は 280x580 のように指定してください。")
        sys.exit(1)

    # テストデータ読み込み（3パターン分に展開）
    print(f"入力ファイル: {args.input}")
    test_data = load_test_data(args.input)
    print(f"展開後のテストデータ: {len(test_data)}件（元データ × 3パターン）")

    # テストシート生成
    generate_test_sheet(
        test_data=test_data,
        sheet_mm=(w_mm, h_mm),
        output_dir=args.output,
    )

    print(f"\n完了: {args.output}/*.png")
    print("\nknockoutパターン:")
    print("  - binary: 2値化（従来方式）α > 20 で完全黒")
    print("  - gradient: αに応じたグラデーション（α値をそのまま使用）")
    print("  - steep: 傾斜グラデーション（低α値も強く黒に寄せる）")


if __name__ == "__main__":
    main()
