# Oryzaeにおける問い

Oryzaeでは「問い」は使用者自ら作成・更新・削除できる。
他にも、「発酵」プロセスによって新規の問いの作成や従来の問いの更新の提案がなされる。使用者は提案を受け容れるか、却下することができる。

## 問いモデルの扱い

jar画面で表示されている問いモデルは以下の2つのテーブルのリレーションで定義される。
Questionテーブルは、使用者に紐づいた「問い」の大元のレコードである。
QuestionTransactionテーブルには、Question.idとリレーションとなっているquestion_idカラムがあり、その時々の「問い」の内容が保存されている。
問いの内容が更新される度に、同じquestion_idを保持した新しいQuestionTransactionレコードが生成される。

Question
id	INT (not null)
user_id	INT (not null)
created_at	DATETIME (not null)
updated_at	DATETIME (not null)
is_archived	FALSE
is_validated_by_user	TRUE
is_proposed_by_oryzae	TRUE or FALSE

QuestionTransaction	
id	INT (not null)
question_id	`Question.id`
string	VARCHAR(64)
question_version	INT (not null)
created_at	DATETIME (not null)
updated_at	DATETIME (not null)
is_validated_by_user	TRUE
is_proposed_by_oryzae	TRUE or FALSE

以上の条件を満たす問いデータが、使用者のアプリにおいて有効化されている問いである。
有効な`Question`レコードに関連する`QuestionTransaction`テーブル内の`is_validated_by_user`が`TRUE`のもののうち`question_version`値が最大の一件が、有効な「問い」の内容としてみなされる。

有効化された問いを対象に、発酵プロセスが特定のタイミングで実行され、その結果のデータが関連テーブルに記録される。
有効化されていない問いは、データは保存されるが、発酵プロセスの対象外となり、jar画面にもエディタ画面にも表示されなくなる。
有効化されていない問いには以下の種類がある。

- 使用者がアーカイブした問い：`Question.is_archived`が`TRUE`になったもの。
- アプリが提案したもので、使用者が承認していない新しい問い：`Question.is_proposed_by_oryzae`が`TRUE`であり、`Question.is_validated_by_user`が`FALSE`のもの。この場合、`Question.id`と同じ`QuestionTransaction.question_id`値を持つ`QuestionTransaction`のレコードがあったとしても、その`is_validated_by_user`も`FALSE`にセットされる。
- アプリが提案したもので、使用者が承認していない問いの更新：`Question.is_proposed_by_oryzae`が`TRUE`であり、`Question.is_validated_by_user`が`TRUE`だが、関連する`QuestionTransaction`レコードの`is_validated_by_user`が`FALSE`のもの。

## 使用者自身による問いの作成・更新・アーカイブ

使用者は、jar画面にて、任意のタイミングで問いを追加したり、編集することができる。

- 新しい問いを作成した場合は、Questionに新しいレコードが追加される。user_idは使用者のID、archivedは`FALSE`。同時に、QuestionTransactionに新しいレコードが追加される。question_idは作成したQuestion.id、stringは新しい問いの文字列、question_versionは`1`、is_validated_by_userは`1`を入れる。

- 既存の問いを編集（文言を変化）した場合は、QuestionTransactionに新しいレコードが追加される。そのquestion_idは元々の問いと同じもの、is_validated_by_userは`1`、question_versionは同じquestion_idを持つ最新レコードの値に+1された値を入れる。GUI

- 既存の問いをアーカイブする場合は、Question.is_archivedを`TRUE`にする。アーカイブされた問いは、jar画面からは非表示になるが、問い一覧画面では閲覧でき、「復活」させることができる。

## 発酵プロセスによる問いの作成・更新の提案

Oryzaeでは「発酵」（日記テキストの分析）プロセスが行われる度に、既存の問いの更新、もしくは新しい問いの提案が行われれる。

## 問いが設定されている場合

設定された「問い」毎に、`ferment_with_question.md`の内容をプロンプトとして実行し、結果を関連DBテーブルに記録する。
この際、当該の「問い」をより良くする提案が行われる場合がある（提案の有無はプロンプト実行時にLLMが判断する）。
提案が行われた場合、それを使用者がjar画面上で承諾すれば、当該`QuestionTransaction`レコードの`is_validated_by_user`は`TRUE`となるが、無視すれば`FALSE`（デフォルト）となる。

## 問いが設定されていない場合

`ferment_without_question.md`の内容をプロンプトとして実行し、結果を関連DBテーブルに記録する。
この際、新しい「問い」が提案される。
それを使用者がjar画面上で承諾すれば、当該`Question`レコードと`QuestionTransaction`レコードの`is_validated_by_user`は`TRUE`となるが、無視すれば`FALSE`（デフォルト）となる。

#### 新しい問いの提案のUI
発酵プロセスの分析が終わり、新しい問いの提案がある場合には、画面左側ペインのグローバルナビゲーション中のjar画面リンクアイコンに、更新の存在を示す赤いバッジが表示される。
jar画面が開かれると、新しい問いの提案があることを示すモーダルウィンドウが開かれる。
モーダルウィンドウ内には、提案された問いの文言が表示され、その下に「Oryzaeがあなたのテキストを基に新しい問いを生成しました。」というテキストを表示し、その下に「受け容れる」ボタンと「無視する」ボタンを配置する。

#### 既存の問いの更新の提案のUI
発酵プロセスの分析が終わり、新しい問いの提案がある場合には、画面左側ペインのグローバルナビゲーション中のjar画面リンクアイコンに、更新の存在を示す赤いバッジが表示される。
jar画面が開かれると、新しい問いの提案があることを示すモーダルウィンドウが開かれる。
モーダルウィンドウ内には、最新の有効化されている問いの文言と、提案された問いの文言が併置されて表示され、「Oryzaeがあなたの問いに対して更新の提案を生成しました。」というテキストを表示し、その下に「受け容れる」ボタンと「無視する」ボタンを配置する。

#### 使用者が既存の問いを更新もしくはアーカイブするUI
jar画面で、瓶の直下に表示されている問いのグラフィック要素をクリックすると、モーダルウィンドウが開き、その中に問いの文言を編集できるフォーム、「保存」ボタン（更新を保存）、「キャンセル」ボタン（変更を保存せずにモーダルウィンドウを閉じる）、「アーカイブ」ボタンを配置する。
