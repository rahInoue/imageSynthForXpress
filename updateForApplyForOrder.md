# index.pyのアップデートが必要
これまでimages.jsonでやっていた処理を、[202508_order_info.json](202508/202508_order_info.json)のオーダー情報と、[202508_order_goods_list.json](202508/2025_order_goods_list.json)の注文商品リストを使って行うようにします。

最終的なオブジェクトは

```json
{
  "char": "images/images_main_139171.png",
  "bg": "images/bg/illustDisplay_bg_Z98_bg.png",
  "logo": "images/logo/Z98_logo.png",
  "orderId": "2",
  "userId": "alpacacpanect",
  "userName": "userName",
  "amount": 1
}
```

となる予定です。
この返還を行うjsスクリプトを作成してください。