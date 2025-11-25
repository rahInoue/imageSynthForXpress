#!/usr/bin/env python3
"""
receiveTypeでフィルタリングして画像を処理するスクリプト

receiveType:
  0 = イベント受け取り（現地受け取り）
  1 = 配送
"""

import json
import sys
import argparse
from pathlib import Path

def filter_orders_by_receive_type(order_info_file, order_images_file, receive_type=0):
    """
    receiveTypeでフィルタリングした画像リストを作成
    """
    # オーダー情報を読み込み
    with open(order_info_file, 'r', encoding='utf-8') as f:
        order_info = json.load(f)

    # 画像情報を読み込み
    with open(order_images_file, 'r', encoding='utf-8') as f:
        order_images = json.load(f)

    # receiveTypeでフィルタリングしたorderIdを取得
    filtered_order_ids = set()
    for order in order_info:
        if str(order.get('receiveType', '')) == str(receive_type):
            filtered_order_ids.add(str(order['orderId']))
            print(f"Found order {order['orderId']} ({order['userName']}) with receiveType={receive_type}")

    print(f"\nTotal orders with receiveType={receive_type}: {len(filtered_order_ids)}")
    print(f"Order IDs: {', '.join(sorted(filtered_order_ids, key=lambda x: int(x) if x.isdigit() else 0))}")

    # 画像をフィルタリング
    filtered_images = []
    for img in order_images:
        if str(img.get('orderId', '')) in filtered_order_ids:
            filtered_images.append(img)

    print(f"\nTotal images after filtering: {len(filtered_images)}")

    # amountを考慮した合計枚数を計算
    total_cards = sum(img.get('amount', 1) for img in filtered_images)
    print(f"Total cards (considering amount): {total_cards}")

    return filtered_images

def main():
    parser = argparse.ArgumentParser(
        description='receiveTypeでフィルタリングして画像を処理'
    )
    parser.add_argument(
        '--order-info',
        default='202508/202508_order_info.test.json',
        help='オーダー情報JSONファイル'
    )
    parser.add_argument(
        '--order-images',
        default='202508/order_images.test.json',
        help='画像情報JSONファイル'
    )
    parser.add_argument(
        '--receive-type',
        type=int,
        default=0,
        choices=[0, 1],
        help='receiveType (0=イベント受け取り, 1=配送)'
    )
    parser.add_argument(
        '--output',
        default='filtered_images.test.json',
        help='フィルタリング後の出力ファイル'
    )
    parser.add_argument(
        '--run-command',
        action='store_true',
        help='画像処理コマンドを自動実行'
    )

    args = parser.parse_args()

    # フィルタリング実行
    filtered_images = filter_orders_by_receive_type(
        args.order_info,
        args.order_images,
        args.receive_type
    )

    if not filtered_images:
        print(f"\nNo images found with receiveType={args.receive_type}")
        sys.exit(1)

    # フィルタリング結果を保存
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(filtered_images, f, ensure_ascii=False, indent=2)

    print(f"\nFiltered images saved to: {args.output}")

    # 処理コマンドを生成
    if args.run_command:
        import subprocess

        # コマンドを構築
        cmd = [
            'python3', 'index.py',
            '--sheet', '280x580',
            '--images', json.dumps(filtered_images),
            '--output-dir', f'output_receive_{args.receive_type}',
            '--knockout-mode', 'normal',
            '--knockout-shrink', '0.05'
        ]

        print("\n" + "="*60)
        print("Executing image processing...")
        print("="*60)

        # コマンド実行
        try:
            subprocess.run(cmd, check=True)
            print("\n✅ Image processing completed successfully!")
            print(f"Output directory: output_receive_{args.receive_type}/")
        except subprocess.CalledProcessError as e:
            print(f"\n❌ Error during image processing: {e}")
            sys.exit(1)
    else:
        # 手動実行用のコマンドを表示
        print("\n" + "="*60)
        print("To process these images, run:")
        print("="*60)
        print(f'python3 index.py --sheet 280x580 \\')
        print(f'  --images "$(cat {args.output})" \\')
        print(f'  --output-dir output_receive_{args.receive_type} \\')
        print(f'  --knockout-mode normal \\')
        print(f'  --knockout-shrink 0.05')

        print("\nOr for parallel processing:")
        print(f'python3 index_parallel.py --sheet 280x580 \\')
        print(f'  --images "$(cat {args.output})" \\')
        print(f'  --output-dir output_receive_{args.receive_type} \\')
        print(f'  --knockout-mode normal \\')
        print(f'  --knockout-shrink 0.05')

if __name__ == '__main__':
    main()