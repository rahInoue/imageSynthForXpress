#!/usr/bin/env python3
# acrylic_sheet_generator_parallel.py - 並列処理版
from pathlib import Path
from typing import List, Tuple, Dict
import math
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import json
import sys
import os
import time

from PIL import Image, ImageDraw, ImageOps, ImageFilter, ImageFont
from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

DPI = 350
MM_PER_INCH = 25.4

def mm_to_px(mm: float, dpi: int = DPI) -> int:
    return int(round(mm / MM_PER_INCH * dpi))

# ---- 主要パラメータ ----------------------------------------------------------
CARD_PX = (768, 1024)
CUTLINE_MM = 2.0
MARGIN_MM = 10.0
SPACING_MM = 10.0
KNOCKOUT_SHRINK_MM = 0.1
KNOCKOUT_THRESHOLD = 20
KNOCKOUT_MIN_ALPHA = 80
# -----------------------------------------------------------------------------

CUTLINE_PX = mm_to_px(CUTLINE_MM)
MARGIN_PX = mm_to_px(MARGIN_MM)
SPACING_PX = mm_to_px(SPACING_MM)
KNOCKOUT_SHRINK_PX = max(1, mm_to_px(KNOCKOUT_SHRINK_MM))

ALLOW_UPSCALE_CHAR = False
ALLOW_UPSCALE_BG = True

def resize_char_canvas(im: Image.Image, target_wh: Tuple[int,int], allow_upscale: bool = ALLOW_UPSCALE_CHAR) -> Image.Image:
    tw, th = target_wh
    w, h = im.size
    scale = min(tw / w, th / h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    new_w, new_h = max(1, int(round(w*scale))), max(1, int(round(h*scale)))
    if (new_w, new_h) != (w, h):
        im = im.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0,0,0,0))
    x = (tw - im.size[0]) // 2
    y = (th - im.size[1]) // 2
    canvas.paste(im, (x, y), im)
    return canvas

def resize_bg_canvas(im: Image.Image, target_wh: Tuple[int,int], allow_upscale: bool = ALLOW_UPSCALE_BG) -> Image.Image:
    tw, th = target_wh
    w, h = im.size
    scale = max(tw / w, th / h)
    if not allow_upscale:
        scale = min(scale, 1.0)
    new_w, new_h = max(1, int(round(w*scale))), max(1, int(round(h*scale)))
    if (new_w, new_h) != (w, h):
        im = im.resize((new_w, new_h), Image.LANCZOS)
    left = max(0, (im.size[0] - tw)//2)
    top = max(0, (im.size[1] - th)//2)
    right = left + tw if im.size[0] >= tw else im.size[0]
    bottom = top + th if im.size[1] >= th else im.size[1]
    crop = im.crop((left, top, right, bottom))
    if crop.size != (tw, th):
        canvas = Image.new("RGBA", (tw, th), (0,0,0,0))
        x = (tw - crop.size[0]) // 2
        y = (th - crop.size[1]) // 2
        canvas.paste(crop, (x, y), crop)
        return canvas
    return crop

def grid_layout(sheet_px, card_px=CARD_PX, margin_px=MARGIN_PX, spacing_px=SPACING_PX, border_px=CUTLINE_PX, left_margin_px=None):
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

# 並列画像読み込み関数
def load_single_image(info: Dict) -> Dict:
    """単一画像の読み込み（並列処理用）"""
    try:
        char = Image.open(info["char"]).convert("RGBA")

        bg = None
        if info.get("bg"):
            bg = Image.open(info["bg"]).convert("RGBA")
        else:
            bg = Image.new("RGBA", CARD_PX, (0, 0, 0, 0))

        logo = None
        if "logo" in info and info["logo"]:
            try:
                logo = Image.open(info["logo"]).convert("RGBA")
            except:
                pass

        return {
            "key": info["key"],
            "char": char,
            "bg": bg,
            "bg_path": info.get("bg"),
            "logo": logo,
            "userName": info.get("userName", info["key"]),
            "orderId": info.get("orderId", ""),
            "amount": info.get("amount", 1)
        }
    except Exception as e:
        print(f"Error loading {info['key']}: {e}")
        return None

def load_images_parallel(image_info: List[Dict], max_workers: int = 4) -> List[Dict]:
    """並列で画像を読み込む"""
    cards = []

    print(f"Loading {len(image_info)} items with {max_workers} workers...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 各画像を並列で読み込み
        future_to_info = {executor.submit(load_single_image, info): info for info in image_info}

        for future in as_completed(future_to_info):
            result = future.result()
            if result:
                # amountに応じて複製
                amount = result.pop("amount", 1)
                for _ in range(amount):
                    cards.append(dict(result))

    print(f"Successfully loaded {len(cards)} cards from {len(image_info)} items")
    return cards

def process_single_page(args):
    """単一ページを処理（並列処理用）"""
    page_no, page_cards, sheet_mm, output_prefix, knockout_shrink_mm, knockout_mode = args

    print(f"Processing page {page_no} with {len(page_cards)} cards...")

    # ローカルで設定を再計算
    shrink_mm = knockout_shrink_mm if knockout_shrink_mm is not None else KNOCKOUT_SHRINK_MM
    shrink_px = max(0, mm_to_px(shrink_mm))

    if knockout_mode == "aggressive":
        threshold = 10
        min_alpha = 50
    elif knockout_mode == "minimal":
        threshold = 50
        min_alpha = 128
    else:  # normal
        threshold = KNOCKOUT_THRESHOLD
        min_alpha = KNOCKOUT_MIN_ALPHA

    # シート設定
    sheet_px = (mm_to_px(sheet_mm[0]), mm_to_px(sheet_mm[1]))
    label_margin_px = mm_to_px(50)
    left_margin_px = MARGIN_PX + label_margin_px

    # レイヤー初期化
    layers = {
        "cutline": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "glare": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "logos": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "logo_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "character": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "char_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "bg_knock": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "background": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
        "labels": Image.new("RGBA", sheet_px, (0, 0, 0, 0)),
    }

    draw_cut = ImageDraw.Draw(layers["cutline"])

    # フォント設定
    try:
        font_size = 100
        font = None
        japanese_fonts = [
            "/System/Library/Fonts/Hiragino Sans GB.ttc",
            "/System/Library/Fonts/PingFang.ttc",
        ]
        for font_path in japanese_fonts:
            try:
                font = ImageFont.truetype(font_path, font_size, index=0)
                break
            except:
                continue
        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # 配置計算
    positions, _, _ = grid_layout(sheet_px=sheet_px, left_margin_px=left_margin_px)

    # カードごとに処理
    for card, (x, y) in zip(page_cards, positions):
        char_img_raw = card["char"]
        bg_img_raw = card["bg"]
        logo_img_raw = card.get("logo")
        user_name = card.get("userName", card["key"])

        char_img = resize_char_canvas(char_img_raw, CARD_PX, allow_upscale=ALLOW_UPSCALE_CHAR)
        bg_img = resize_bg_canvas(bg_img_raw, CARD_PX, allow_upscale=ALLOW_UPSCALE_BG)

        # background
        layers["background"].paste(bg_img, (x, y), bg_img)

        # bg_knockout
        if card.get("bg_path"):
            bg_mask = Image.new("L", CARD_PX, 255)
            black_bg = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
            layers["bg_knock"].paste(black_bg, (x, y), bg_mask)

        # character
        layers["character"].paste(char_img, (x, y), char_img)

        # logo
        if logo_img_raw:
            logo_img = resize_char_canvas(logo_img_raw, CARD_PX, allow_upscale=True)
            layers["logos"].paste(logo_img, (x, y), logo_img)

            # logo knockout
            logo_alpha = logo_img.split()[-1]
            logo_alpha_processed = logo_alpha.point(lambda p: 0 if p < threshold else 255)
            if shrink_px > 0:
                logo_alpha_smooth = logo_alpha_processed.filter(ImageFilter.GaussianBlur(radius=0.3))
                logo_knock = logo_alpha_smooth.filter(ImageFilter.MinFilter(3))
            else:
                logo_knock = logo_alpha_processed
            black_logo = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
            layers["logo_knock"].paste(black_logo, (x, y), logo_knock)

        # character knockout
        alpha = char_img.split()[-1]
        alpha_processed = alpha.point(lambda p: 0 if p < threshold else 255)
        if shrink_px > 0:
            alpha_smooth = alpha_processed.filter(ImageFilter.GaussianBlur(radius=0.3))
            knock = alpha_smooth.filter(ImageFilter.MinFilter(3))
        else:
            knock = alpha_processed
        black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["char_knock"].paste(black, (x, y), knock)

        # glare
        black = Image.new("RGBA", CARD_PX, (0, 0, 0, 255))
        layers["glare"].paste(black, (x, y), alpha)

        # cutline
        bx1 = x - CUTLINE_PX
        by1 = y - CUTLINE_PX
        bx2 = x + CARD_PX[0] + CUTLINE_PX - 1
        by2 = y + CARD_PX[1] + CUTLINE_PX - 1
        draw_cut.rectangle([(bx1, by1), (bx2, by2)], outline=(0, 0, 0, 255), width=CUTLINE_PX)

        # labels
        key_text = user_name
        text_img = Image.new("RGBA", (CARD_PX[1], 600), (0, 0, 0, 0))
        text_draw = ImageDraw.Draw(text_img)
        try:
            text_draw.text((20, 300), key_text, fill=(0, 0, 0, 255), font=font)
        except:
            pass
        rotated_text = text_img.rotate(90, expand=True)
        label_margin = mm_to_px(5)
        text_width = rotated_text.width
        text_height = rotated_text.height
        label_right_shift = 240  # 300pxから60px左へ調整（画像にかぶらないよう）
        text_x = bx1 - label_margin - text_width + label_right_shift
        if text_x < 10:
            text_x = 10
        text_y = by1 + (by2 - by1) // 2 - text_height // 2
        layers["labels"].paste(rotated_text, (text_x, text_y), rotated_text)

    # PNG出力
    for name, img in layers.items():
        if (name == "logos" or name == "logo_knock") and not any(card.get("logo") for card in page_cards):
            continue
        path = f"{output_prefix}_{name}.png"
        img.save(path, dpi=(DPI, DPI))

    print(f"Page {page_no} completed")
    return page_no

def process_pages_parallel(
    image_info: List[Dict],
    sheet_mm: Tuple[float, float],
    output_prefix: str = "sheet",
    output_dir: str = ".",
    knockout_shrink_mm: float = None,
    knockout_mode: str = "normal",
    max_workers: int = None
):
    """ページを並列処理"""
    import os
    from math import ceil
    from collections import defaultdict

    # CPUコア数に基づいて最適なワーカー数を決定
    if max_workers is None:
        max_workers = min(4, mp.cpu_count())

    print(f"Using {max_workers} parallel workers")

    # orderIdごとにグループ化
    orders = defaultdict(list)
    for item in image_info:
        order_id = item.get("orderId", "no_order")
        orders[order_id].append(item)

    sorted_order_ids = sorted(orders.keys(), key=lambda x: int(x) if x.isdigit() else float('inf'))

    grouped_image_info = []
    for order_id in sorted_order_ids:
        grouped_image_info.extend(orders[order_id])

    # カード数計算
    temp_sheet_px = (mm_to_px(sheet_mm[0]), mm_to_px(sheet_mm[1]))
    _, rows, cols = grid_layout(sheet_px=temp_sheet_px)
    cards_per_page = rows * cols

    # 画像を並列で読み込み
    start_time = time.time()
    expanded_cards = load_images_parallel(grouped_image_info, max_workers=max_workers)
    load_time = time.time() - start_time
    print(f"Image loading completed in {load_time:.2f} seconds")

    # ページ分割
    total_cards = len(expanded_cards)
    total_pages = ceil(total_cards / cards_per_page)

    print(f"合計 {len(image_info)} アイテム → {total_cards} 枚のカード")
    print(f"{total_pages} ページに分割します")

    # ページごとの処理タスクを作成
    page_tasks = []
    for page_no in range(1, total_pages + 1):
        start_idx = (page_no - 1) * cards_per_page
        end_idx = min(page_no * cards_per_page, total_cards)
        page_cards = expanded_cards[start_idx:end_idx]

        page_dir = os.path.join(output_dir, f"{page_no}")
        if not os.path.exists(page_dir):
            os.makedirs(page_dir, exist_ok=True)

        page_prefix = os.path.join(page_dir, output_prefix)
        page_tasks.append((
            page_no, page_cards, sheet_mm, page_prefix,
            knockout_shrink_mm, knockout_mode
        ))

    # ページを並列処理
    process_start = time.time()
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(process_single_page, task) for task in page_tasks]
        for future in as_completed(futures):
            try:
                page_no = future.result()
            except Exception as e:
                print(f"Error processing page: {e}")

    process_time = time.time() - process_start
    total_time = time.time() - start_time

    print(f"\n処理完了:")
    print(f"  画像読み込み: {load_time:.2f}秒")
    print(f"  ページ生成: {process_time:.2f}秒")
    print(f"  合計時間: {total_time:.2f}秒")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Acrylic Sheet Generator (Parallel)")
    parser.add_argument("--sheet", default="280x580", help="シート寸法 mm")
    parser.add_argument("--images", required=True, help="JSON")
    parser.add_argument("--prefix", default="sheet", help="出力ファイル名前の接頭辞")
    parser.add_argument("--output-dir", default="output", help="出力ディレクトリ")
    parser.add_argument("--one-page", action="store_true", help="ページ分割せず1シートに")
    parser.add_argument("--knockout-shrink", type=float, default=0.1, help="白板の収縮量(mm)")
    parser.add_argument(
        "--knockout-mode",
        choices=["normal", "aggressive", "minimal"],
        default="normal",
        help="白板処理モード"
    )
    parser.add_argument("--workers", type=int, help="並列ワーカー数（デフォルト: CPUコア数）")

    args = parser.parse_args()

    try:
        w_mm, h_mm = map(float, args.sheet.lower().split("x"))
    except:
        sys.exit("シート寸法は 280x580 のように指定してください。")

    try:
        image_info = json.loads(args.images)
    except:
        sys.exit("--images に JSON 形式でパスを渡してください。")

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)

    # 並列処理実行
    process_pages_parallel(
        image_info=image_info,
        sheet_mm=(w_mm, h_mm),
        output_prefix=args.prefix,
        output_dir=args.output_dir,
        knockout_shrink_mm=args.knockout_shrink,
        knockout_mode=args.knockout_mode,
        max_workers=args.workers
    )