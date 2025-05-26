#!/usr/bin/env python3
# acrylic_sheet_generator.py
from pathlib import Path
from typing import List, Tuple, Dict
import math

from PIL import Image, ImageDraw, ImageOps, ImageFilter

DPI = 350
MM_PER_INCH = 25.4


def mm_to_px(mm: float, dpi: int = DPI) -> int:
    return int(round(mm / MM_PER_INCH * dpi))


# ---- 主要パラメータ ----------------------------------------------------------
CARD_PX = (768, 1024)                # カードサイズ（ピクセル）固定値 - アクリルカードの実寸法に対応
CUTLINE_MM = 2.0                     # カットライン（黒線）の幅（ミリメートル）- 印刷時の切断基準線
MARGIN_MM = 10.0                     # シート外周の余白（ミリメートル）- 印刷可能領域の境界
SPACING_MM = 10.0                    # カード間の間隔（ミリメートル）- 各カードの配置間隔
KNOCKOUT_SHRINK_MM = 0.2             # 白抜き（ノックアウト）の縮小量（ミリメートル）- シルエット生成時の収縮幅
# -----------------------------------------------------------------------------

CUTLINE_PX = mm_to_px(CUTLINE_MM)
MARGIN_PX = mm_to_px(MARGIN_MM)
SPACING_PX = mm_to_px(SPACING_MM)
KNOCKOUT_SHRINK_PX = max(1, mm_to_px(KNOCKOUT_SHRINK_MM))


def grid_layout(
    sheet_px: Tuple[int, int],
    card_px: Tuple[int, int] = CARD_PX,
    margin_px: int = MARGIN_PX,
    spacing_px: int = SPACING_PX,
    border_px: int = CUTLINE_PX,
    left_margin_px: int = None,  # 左側のマージン（ピクセル）- ラベル表示用に左側のみ広げる場合に使用
):
    """カード左上座標を返す簡易グリッドレイアウト"""
    fw, fh = card_px[0] + border_px * 2, card_px[1] + border_px * 2
    
    # 左右で異なるマージンを使う場合
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


def load_images(image_info: List[Dict]) -> List[Dict]:
    """各カード用に {key, char_img, bg_img} を読み込む"""
    cards = []
    for info in image_info:
        char = Image.open(info["char"]).convert("RGBA").resize(CARD_PX)
        bg   = Image.open(info["bg"]).convert("RGBA").resize(CARD_PX)
        cards.append({"key": info["key"], "char": char, "bg": bg})
    return cards


def make_sheet_layers(
    sheet_mm: Tuple[float, float],
    card_data: List[Dict],
    output_prefix: str = "sheet",
):
    # --- シート寸法 ---
    # 実際のシート寸法をピクセルに変換（余白なし）
    sheet_px_original = (mm_to_px(sheet_mm[0]), mm_to_px(sheet_mm[1]))
    
    # 左側のラベル用に余分なマージンを追加（シートサイズは変わらない）
    label_margin_mm = 50  # ラベル表示用の左側追加マージン（ミリメートル）- キー識別子の表示スペース確保
    label_margin_px = mm_to_px(label_margin_mm)
    
    # デバッグ情報
    print(f"シート寸法(mm): {sheet_mm[0]} x {sheet_mm[1]}")
    print(f"シート寸法(px): {sheet_px_original[0]} x {sheet_px_original[1]}")
    print(f"ラベル用マージン: {label_margin_mm}mm ({label_margin_px}px)")
    
    # シート寸法はそのまま使用
    sheet_size = sheet_px_original
    
    # MARGINを調整 - 左側だけ増やす
    left_margin_px = MARGIN_PX + label_margin_px
    # --- レイヤ初期化 ---
    layers = {
        "cutline": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "glare":   Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "character": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "char_knock": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "bg_knock": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "background": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),
        "labels": Image.new("RGBA", sheet_size, (0, 0, 0, 0)),  # キーラベル用の新しいレイヤー
    }
    draw_cut = ImageDraw.Draw(layers["cutline"])
    
    # フォント設定 (Pillow の標準フォントを使用)
    try:
        from PIL import ImageFont
        # MacOS でよく使われるフォントを試す
        font_size = 120  # 5倍の大きさに変更
        try:
            font = ImageFont.truetype("Arial.ttf", font_size)
        except IOError:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
            except IOError:
                try:
                    font = ImageFont.truetype("/Library/Fonts/Arial.ttf", font_size)
                except IOError:
                    font = ImageFont.load_default()
    except (IOError, ImportError):
        font = ImageFont.load_default()

    # --- 配置計算 ---
    positions, rows, cols = grid_layout(
        sheet_px=sheet_size,
        left_margin_px=left_margin_px  # 左側の余白を増やす
    )
    print(f"シートレイアウト: {cols}列 x {rows}行 = 最大{len(positions)}枚")
    if len(card_data) > len(positions):
        raise ValueError("シートに入りきりません：画像数を減らすかシートを拡大してください。")

    # --- カードごとに処理 ---
    for card, (x, y) in zip(card_data, positions):
        char_img = card["char"]
        bg_img   = card["bg"]

        # background
        layers["background"].paste(bg_img, (x, y), bg_img)

        # bg_knockout: 背景ノックアウト - カード領域全体を完全黒（不透明）で塗りつぶし
        bg_mask = Image.new("L", CARD_PX, 255)
        black_bg = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["bg_knock"].paste(black_bg, (x, y), bg_mask)

        # character
        layers["character"].paste(char_img, (x, y), char_img)

        # character knockout: キャラクターノックアウト - アルファチャンネルを収縮させて黒シルエット生成
        alpha = char_img.split()[-1]  # アルファチャンネル（透明度情報）を抽出
        knock = alpha.filter(ImageFilter.MinFilter(KNOCKOUT_SHRINK_PX*2+1))  # MinFilterで収縮処理
        black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["char_knock"].paste(black, (x, y), knock)

        # glare layer: グレア効果レイヤー - キャラクターのアルファチャンネルをマスクとして黒色で塗りつぶし
        black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["glare"].paste(black, (x, y), alpha)

        # cutline: カットライン（矩形枠）- 印刷時の切断位置を示す黒線
        bx1 = x - CUTLINE_PX  # 左端座標（カード位置から線幅分外側）
        by1 = y - CUTLINE_PX  # 上端座標（カード位置から線幅分外側）
        bx2 = x + CARD_PX[0] + CUTLINE_PX - 1  # 右端座標
        by2 = y + CARD_PX[1] + CUTLINE_PX - 1  # 下端座標
        draw_cut.rectangle(
            [(bx1, by1), (bx2, by2)], outline=(0, 0, 0, 255), width=CUTLINE_PX
        )
        
        # key テキスト描画: カード識別子を左側に-90度回転して配置
        key_text = card["key"]  # カードの識別子（JSONで指定されたキー）
        # テキスト描画用の一時画像を作成（回転前の縦長サイズ）
        text_img = Image.new("RGBA", (CARD_PX[1], 600), (0, 0, 0, 0))  # 幅=カード高さ、高さ=600px
        text_draw = ImageDraw.Draw(text_img)
        
        # テキストを中央寄せで描画
        try:
            w, h = text_draw.textsize(key_text, font=font)
            position = ((text_img.width - w) // 2, (text_img.height - h) // 2)
            text_draw.text(position, key_text, fill=(0, 0, 0, 255), font=font)
        except (AttributeError, TypeError):
            # 新しいバージョンのPILではtextsizeが非推奨
            try:
                text_draw.text((20, 300), key_text, fill=(0, 0, 0, 255), font=font, anchor="lm")
            except TypeError:
                # 古いバージョンのPILでは単純にテキスト描画
                text_draw.text((20, 300), key_text, fill=(0, 0, 0, 255), font=font)
                
        # -90度回転（時計回り90度）- 縦書き風のラベル表示を実現
        rotated_text = text_img.rotate(90, expand=True)
        
        # カットラインとラベルの間隔設定
        label_margin = mm_to_px(5)  # カットラインから5mm離す - ラベルが切断されないための安全距離
        
        # テキスト画像の幅と高さを取得
        text_width = rotated_text.width
        text_height = rotated_text.height
        
        # ラベル位置の微調整 - デフォルトではカードから離れすぎるため右側へシフト
        label_right_shift = 280  # ラベルを右に280px移動 - 視認性向上のための位置調整
        
        # カットラインの左側の座標（右に移動して画像に近づける）
        text_x = bx1 - label_margin - text_width + label_right_shift
        
        # シート外にはみ出さないように調整
        if text_x < 10:  # 左端に最低10pxの余白を確保
            text_x = 10
            
        text_y = by1 + (by2 - by1) // 2 - text_height // 2  # 垂直方向中央
        
        # テキストをラベルレイヤーに貼り付け
        layers["labels"].paste(rotated_text, (text_x, text_y), rotated_text)

    # --- PNG 出力 ---
    for name, img in layers.items():
        path = f"{output_prefix}_{name}.png"
        img.save(path, dpi=(DPI, DPI))
        print("Saved:", path)


# ------------------------ 使い方例 -------------------------------
def process_pages(
    image_info: List[Dict],
    sheet_mm: Tuple[float, float],
    output_prefix: str = "sheet",
    output_dir: str = ".",
):
    """画像情報をページ分割して処理する"""
    import os
    from math import ceil
    
    # シート1枚あたりのカード数を計算 - ページ分割のための事前計算
    temp_sheet_px = (mm_to_px(sheet_mm[0]), mm_to_px(sheet_mm[1]))
    _, rows, cols = grid_layout(sheet_px=temp_sheet_px)
    cards_per_page = rows * cols  # 1ページに配置可能な最大カード数
    
    # 必要なページ数を計算
    total_cards = len(image_info)
    total_pages = ceil(total_cards / cards_per_page)
    
    print(f"合計 {total_cards} 枚のカード、{total_pages} ページに分割します")
    print(f"1ページあたり 最大{cards_per_page}枚 ({cols}列 x {rows}行)")
    
    # ページごとに処理
    for page_no in range(1, total_pages + 1):
        # このページに含めるカードの範囲を計算
        start_idx = (page_no - 1) * cards_per_page
        end_idx = min(page_no * cards_per_page, total_cards)
        
        # このページのカードデータを取得
        page_image_info = image_info[start_idx:end_idx]
        print(f"ページ {page_no}/{total_pages}: {len(page_image_info)} 枚のカード処理中...")
        
        # ページ用のディレクトリを作成（数字だけのフォルダ名）- makePSD.jsが認識できる形式
        page_dir = os.path.join(output_dir, f"{page_no}")  # 例: output/1, output/2
        if not os.path.exists(page_dir):
            os.makedirs(page_dir, exist_ok=True)
        
        # このページ用の出力プレフィックス
        page_prefix = os.path.join(page_dir, output_prefix)
        
        # このページのカードを処理
        cards = load_images(page_image_info)
        make_sheet_layers(sheet_mm=sheet_mm, card_data=cards, output_prefix=page_prefix)
        
        print(f"ページ {page_no} 完了: {page_dir}/*.png\n")


if __name__ == "__main__":
    import argparse, json, sys, os

    parser = argparse.ArgumentParser(
        description="Acrylic Sheet Generator (350 dpi, Pillow)"
    )
    parser.add_argument(
        "--sheet", default="280x580", help="シート寸法 mm 例: 280x580"
    )
    parser.add_argument(
        "--images",
        required=True,
        help="JSON: [{'key': 'ch1','char':'path.png','bg':'path.jpg'}, ...]",
    )
    parser.add_argument(
        "--prefix", default="sheet", help="出力ファイル名前の接頭辞"
    )
    parser.add_argument(
        "--output-dir", default="output", help="出力ディレクトリ"
    )
    parser.add_argument(
        "--one-page", action="store_true", help="ページ分割せず1シートにすべて出力"
    )
    args = parser.parse_args()

    try:
        w_mm, h_mm = map(float, args.sheet.lower().split("x"))
    except Exception:
        sys.exit("シート寸法は 280x580 のように指定してください。")

    try:
        image_info = json.loads(args.images)
    except json.JSONDecodeError:
        sys.exit("--images に JSON 形式でパスを渡してください。")
    
    # 出力ディレクトリの作成
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)
    
    if args.one_page:
        # 単一ページとして処理
        cards = load_images(image_info)
        output_prefix = os.path.join(args.output_dir, args.prefix)
        make_sheet_layers(sheet_mm=(w_mm, h_mm), card_data=cards, output_prefix=output_prefix)
    else:
        # 複数ページに分割して処理
        process_pages(
            image_info=image_info,
            sheet_mm=(w_mm, h_mm),
            output_prefix=args.prefix,
            output_dir=args.output_dir
        )