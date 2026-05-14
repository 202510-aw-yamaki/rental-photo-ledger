import type { PhotoCategory } from "./types";

export const APP_NAME = "賃貸写真台帳メーカー";

export const APP_NOTICE =
  "このアプリは、部屋の状態を記録・整理するためのものです。法律判断や費用負担の判断は行いません。";

export const PDF_NOTICE =
  "この台帳は、部屋の状態を記録・整理することを目的としたものです。法律判断や費用負担の判断を行うものではありません。";

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  "壁",
  "床",
  "天井",
  "ドア",
  "窓",
  "収納",
  "キッチン",
  "浴室",
  "洗面",
  "トイレ",
  "水回り",
  "エアコン",
  "電気設備",
  "備え付け設備",
  "ベランダ",
  "その他"
];

export const SHARE_MAIL_SUBJECT = "入居時の部屋の状態記録について";

export const SHARE_MAIL_BODY =
  "お世話になっております。\n\n入居時の部屋の状態について、確認した内容を写真台帳として整理しました。\n念のため、記録として共有いたします。\n\n添付のPDFをご確認ください。\n\nなお、この台帳は部屋の状態を記録・整理する目的で作成したものです。\n\nよろしくお願いいたします。";
