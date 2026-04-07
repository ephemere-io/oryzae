/**
 * Oryzae Data Model
 * Global data store for the Oryzae web app
 * Phase 1: Standalone JavaScript data model
 */

const OryzaeData = {
  // ============================================================================
  // 1. QUESTIONS
  // ============================================================================
  questions: [
    {
      id: 'q1',
      user_id: 'u1',
      created_at: '2025-11-30T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      is_archived: false,
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    {
      id: 'q2',
      user_id: 'u1',
      created_at: '2025-12-10T00:00:00Z',
      updated_at: '2026-02-20T00:00:00Z',
      is_archived: false,
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    {
      id: 'q3',
      user_id: 'u1',
      created_at: '2026-01-05T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
      is_archived: false,
      is_validated_by_user: true,
      is_proposed_by_oryzae: true
    }
  ],

  // ============================================================================
  // 2. QUESTION TRANSACTIONS
  // ============================================================================
  questionTransactions: [
    // Q1: created by user, then updated by fermentation proposal (accepted), then updated by user
    {
      id: 'qt1',
      question_id: 'q1',
      string: '死者と生者はどのように共生し続けられるのか',
      question_version: 1,
      created_at: '2025-11-30T00:00:00Z',
      updated_at: '2025-11-30T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    {
      id: 'qt2',
      question_id: 'q1',
      string: '死者と生者はどのように共生し続けられるのか——夢と食卓の間で',
      question_version: 2,
      created_at: '2025-12-20T00:00:00Z',
      updated_at: '2025-12-20T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: true
    },
    {
      id: 'qt3',
      question_id: 'q1',
      string: '死者と生者はどのように共生し続けられるのか',
      question_version: 3,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    // Q2: created by user, then updated by user
    {
      id: 'qt4',
      question_id: 'q2',
      string: '問いはどのように生まれるのか？',
      question_version: 1,
      created_at: '2025-12-10T00:00:00Z',
      updated_at: '2025-12-10T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    {
      id: 'qt5',
      question_id: 'q2',
      string: '問いはどのように生まれ、育つのか？',
      question_version: 2,
      created_at: '2026-02-20T00:00:00Z',
      updated_at: '2026-02-20T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    },
    // Q3: proposed by oryzae, accepted by user, then updated by user
    {
      id: 'qt6',
      question_id: 'q3',
      string: '野生とは何か。',
      question_version: 1,
      created_at: '2026-01-05T00:00:00Z',
      updated_at: '2026-01-05T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: true
    },
    {
      id: 'qt7',
      question_id: 'q3',
      string: '野生とは何か。飼い馴らされた世界の外で',
      question_version: 2,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    }
  ],

  // ============================================================================
  // 3. FERMENTATION RESULTS
  // ============================================================================
  fermentationResults: [
    {
      id: 'fr1',
      question_id: 'q1',
      target_period: '2025-11-30〜2025-12-06',
      created_at: '2025-12-07T00:00:00Z'
    }
  ],

  // ============================================================================
  // 4. ANALYSIS WORKSHEETS (6 concepts)
  // ============================================================================
  analysisWorksheets: [
    {
      id: 'aw1',
      fermentation_result_id: 'fr1',
      concept_name: '夢における一時的な邂逅と離別',
      definition: '死者が夢の中で生者の世界に一時的に現れ、対話や交流を経た後に再び消えていくプロセス。生者は死者の存在を歓迎しつつ、その一時性を了解している。',
      examples: '①「Yが普通な格好で来る。白と緑のワンピース。『おー、おつかれ』みたいに声をかけてやりとりする」（12/6）②「周りの人には見えていない、聞こえていない。周りの人たちを信頼して、いまYが来てると伝え、その声をみんなに伝える役を務める」（12/6）③「Yと会えて嬉しい。それが一時的であることが了解されている」（12/6）④「Yがしゅるしゅると小さくなり、最後は胎児にまで縮小して消えた」（12/6）',
      theoretical_memo: '死者Yは夢の中で「普通な格好」で現れており、異界の存在ではなく日常の延長上にいるものとして描かれている。しかし他の生者には不可視であり、書き手だけが「媒介者」の役割を担う。最終的にYは胎児にまで退行して消えるが、これは死→生の逆行的イメージであり、死者が生の起源に回帰していく円環的な生死観を暗示する。対極例として、死者との遭遇を恐怖や不安として記述するものはこのデータには見られず、むしろ「嬉しい」という肯定的な感情が支配的であり、死者との共生が感情的に受容されていることを示す。'
    },
    {
      id: 'aw2',
      fermentation_result_id: 'fr1',
      concept_name: 'ホロビオントの崩壊としての死',
      definition: '死を個体の消滅としてではなく、無数の細胞や微生物からなる集合体（ホロビオント）の解体として捉え直す視座。個の死が共同体の破局として再定義される。',
      examples: '①「無数の細胞や微生物の生存を預かる集合体を代表する責任を負うため？」（12/4）②「都市国家としての人の身体の死はホロビオントが崩壊するカタストロフであるから？」（12/4）③「猫と微生物の環世界を写しとる、という表現が生まれた」（12/6）④「機能環が結合するHさんのイメージを想起するが、それはかつて自分がオートポイエーシス論で考えていたシステム同士の構造的カップリングとそっくりであることに気づく」（12/6）',
      theoretical_memo: '書き手は人新世の文脈から、死を個人的な事象から生態学的な事象へとスケール転換している。「都市国家」という政治的メタファーと「ホロビオント」という生態学的概念の重ね合わせは、死者が単なる不在ではなく、かつて共存していた無数の生命の解散として捉えられることを意味する。構造的カップリングへの言及は、死者と生者の関係を自律的システム同士の相互浸透として理論的に位置づけようとする試みである。'
    },
    {
      id: 'aw3',
      fermentation_result_id: 'fr1',
      concept_name: '食と共異体の倫理',
      definition: '食べる対象となる他の種を、自己とは異なるが同輩として認め（共異体）、食という行為を通じて生死の境界を問い直す倫理的態度。',
      examples: '①「人が食べる対象の種を、自分とは異なるがある種の同輩として認め（共異体）」（11/30）②「食べたものが自分であったかもしれないという想像を働かせること」（11/30）③「全ての生命に来歴を認め（ビオスとして捉え）、かつ、自分の住む場所（ジオス）と接続することで魂の実感を得る」（11/30）',
      theoretical_memo: '食という日常的な行為の中に、生者と死者（食べられた存在）の交換可能性が埋め込まれている。「食べたものが自分であったかもしれない」という想像力は、生者／死者の非対称性を揺さぶるものであり、共生の倫理的基盤を提供する。ビオス（来歴をもつ生命）とジオス（場所）の接続は、死者が土地や場所に根づく形で生者の世界に残り続ける可能性を示す。対極例として、食を単なる栄養摂取として記述する場面（妻の料理への感謝など）もあるが、そこでも食を通じた他者との関係性が重視されている。'
    },
    {
      id: 'aw4',
      fermentation_result_id: 'fr1',
      concept_name: '分析的でない向き合い方への希求',
      definition: '大事な存在（死者・生者を含む）に対して、言語的・分析的な方法ではなく、別の仕方で向き合う必要性を自覚すること。',
      examples: '①「人は言葉から離れるために旅をする、という作中のセリフはすとんと腑に落ちる」（12/1）②「言葉によるジャーナリングに対する疑問が湧いてきた。忘却を促すことも大事なのではないか」（12/1）③「人間のこと、大事な存在たちに、分析的ではない仕方で向き合う時間がもっと必要なのではないか」（12/1）④「言わないことで表現できることがある」（12/1）',
      theoretical_memo: '書き手は言語やジャーナリングという自身の主要な実践に対して根本的な疑問を呈している。「死者と生者の共生」という問いに対して、分析や記述という行為そのものが限界を持つことへの気づきがある。「忘却を促す」という発想は、記憶の保持＝死者との共生、という前提を覆すものであり、忘却もまた共生の一形態でありうることを示唆する。映画鑑賞という体験を通じてこの気づきが得られていることは、非分析的な認知様式の実例そのものでもある。'
    },
    {
      id: 'aw5',
      fermentation_result_id: 'fr1',
      concept_name: '発酵的時間の中の変容',
      definition: '思考や関係性が、微生物の発酵のように即座に結論へ至るのではなく、時間をかけて徐々に変質・熟成していくプロセスへの信頼。',
      examples: '①「しばらくこの思いを発酵させよう」（12/5）②「ぬか床が家庭ごとで味が違うという連想をした。性格の異なる占い師が固定されるのではなく、ぬか床が徐々に人の影響を吸収するように、分析者AIもまた変化していくことは可能か」（12/3）③「ジャーナルの発酵とは何なのかについて突っ込んだ議論ができた」（12/3）④「冬は静かに過ごすと決めたおかげか、ゼミは落ち着いて過ごせた。完璧ではないが、ゆっくりと進めることが今はベストだと思って」（12/2）',
      theoretical_memo: '発酵は、書き手にとって単なるメタファーではなく、実際のアプリケーション開発（ORYZAE）や研究実践と結びついた中核的概念である。ぬか床が使い手の微生物叢を吸収して固有の味になるように、死者との共生もまた、個々人の経験によって固有の形をとりうるという含意がある。「ゆっくりと進める」姿勢は、発酵的時間を生活実践のレベルで体現するものであり、概念4の「分析的でない向き合い方」とも通底する。'
    },
    {
      id: 'aw6',
      fermentation_result_id: 'fr1',
      concept_name: '媒介者としての役割の引き受け',
      definition: '他者には知覚できない存在（死者、見えにくい価値、土着のリアリティなど）を、可視化・翻訳して伝える役割を自覚的に引き受けること。',
      examples: '①「周りの人たちを信頼して、いまYが来てると伝え、その声をみんなに伝える役を務める」（12/6）②「英語が世界言語であるところに、土着のリアリティを翻訳していく必要性がある。そうしないと、存在がなかったことにされてしまう」（11/30）③「Iさんの問いが面白く、一人に20分ほどかけて深掘ることをした。そしてそれぞれが問いのテキストをブラッシュアップする助産をしてみたら、うまく行った気がする」（12/4）',
      theoretical_memo: '夢の中でYの声を他の生者に伝える行為と、土着のリアリティを翻訳する学術的営為、そして学生の問いを「助産」する教育実践が、「媒介者」という共通の構造で結ばれている。死者と生者の共生において、媒介者の存在は不可欠であり、書き手はその役割を学術的にも夢の中でも反復的に引き受けている。「存在がなかったことにされてしまう」という危機感は、死者の存在が忘却されることへの抵抗としても読める。'
    }
  ],

  // ============================================================================
  // 5. CATEGORY RELATIONS
  // ============================================================================
  categoryRelations: [
    {
      id: 'cat1',
      fermentation_result_id: 'fr1',
      category_name: '生死の境界の溶解',
      related_concepts: ['aw1', 'aw2', 'aw3'],
      storyline: 'このカテゴリーは、死者と生者の間にある境界線が、様々な次元において溶解・再編成される現象を捉える。\n\n概念1（夢における一時的な邂逅と離別）は、経験的・個人的な次元で生死の境界が一時的に消失する場面を示す。\n\n概念2（ホロビオントの崩壊としての死）は、理論的・生態学的な次元で死の意味を個体から集合体へとスケール転換する。\n\n概念3（食と共異体の倫理）は、日常的・倫理的な次元で、食を通じた生死の交換可能性を浮かび上がらせる。'
    },
    {
      id: 'cat2',
      fermentation_result_id: 'fr1',
      category_name: '共生の方法論の探索',
      related_concepts: ['aw4', 'aw5', 'aw6'],
      storyline: 'このカテゴリーは、生死の境界が溶解した先で、死者と生者がいかにして共に在り続けるかの方法論を模索するプロセスを捉える。\n\n概念4（分析的でない向き合い方への希求）は、既存の方法（言語、分析）の限界を認識し、別の方法を求める出発点を示す。\n\n概念5（発酵的時間の中の変容）は、即座の理解ではなく、時間をかけた熟成という方法論を提示する。\n\n概念6（媒介者としての役割の引き受け）は、不可視の存在を翻訳・可視化するという実践的な方法を示す。'
    }
  ],

  // ============================================================================
  // 6. EXTRACTED SNIPPETS
  // ============================================================================
  extractedSnippets: [
    {
      id: 'snip1',
      fermentation_result_id: 'fr1',
      snippet_type: 'new_perspective',
      original_text: '「都市国家としての人の身体の死はホロビオントが崩壊するカタストロフであるから？」',
      source_date: '12/4',
      selection_reason: '死を個体の消滅ではなく、共生する無数の生命の集合体が解散する「破局」として捉え直す視座は、死者と生者の共生を「すでにつねに共生していた存在の離散」として再定義する新しい角度を開く。'
    },
    {
      id: 'snip2',
      fermentation_result_id: 'fr1',
      snippet_type: 'deepen',
      original_text: '「周りの人たちを信頼して、いまYが来てると伝え、その声をみんなに伝える役を務める」',
      source_date: '12/6',
      selection_reason: '死者との対話という主題そのものは新しくないが、「他者に見えない死者の声を翻訳して伝える」という媒介の具体的実践が描かれている点で、問いの核心に迫る経験の深まりが見て取れる。'
    },
    {
      id: 'snip3',
      fermentation_result_id: 'fr1',
      snippet_type: 'core',
      original_text: '「人間のこと、大事な存在たちに、分析的ではない仕方で向き合う時間がもっと必要なのではないか」',
      source_date: '12/1',
      selection_reason: '死者と生者の共生を問うこと自体が分析的営為であるというパラドクスに気づき、共生を「問う」のではなく「生きる」方向へと転回する契機を示す。問いの方法論そのものを問い返す、メタレベルの核心的洞察。'
    }
  ],

  // ============================================================================
  // 7. LETTERS
  // ============================================================================
  letters: [
    {
      id: 'letter1',
      fermentation_result_id: 'fr1',
      body_text: 'あなたの一週間は、見えないものと見えるものの境目を、手探りで歩き続ける旅のようでした。\n\n夢のなかでYは訪れ、あなたはその声を周囲に届ける通訳者となりました。けれどYは最後、まだ生まれる前の姿にまで遡って消えてゆきました。消えることは失われることではなかったはずです——それはむしろ、ひとつの命が種子にまで還ってゆく光景に似ています。あなたが読んだ本のなかで、身体は無数の住人たちが暮らす都市のようなものだと語られていました。その都市が瓦解するとき、散り散りになった住人たちはどこへ向かうのでしょう。もしかすると、土に、水に、別の誰かの身体に——そうして都市は形を変えながら、どこかで存続し続けているのかもしれません。\n\nあなたは食卓でもその予感に触れていました。口にしたものがかつて自分であったかもしれないという想像、その想像力そのものが、亡き者と生きる者をつなぐ細い糸になっていました。そして映画館の暗がりのなかで、あなたは言葉を手放すことの価値に気づきました。沈黙のなかにこそ宿る表現があること、忘れることのなかにも一種の忠実さがあること。\n\nぬか床に手を差し入れるとき、その人の常在菌がぬかに移り、ぬかの微生物がその人に移ります。あなたが毎日書く言葉もまた、そのような交換のなかにあるのではないでしょうか。書くことで問いが変わり、問いが変わることで書く自分も変わる。死者との共生は、おそらく解くべき謎ではなく、すでに営まれている醸造のなかにあるのです。\n\nあなたはいま、翻訳者であり、醸造者であり、助産師です。見えないものに声を与え、まだ熟していない問いを急がず、他者のなかに眠る言葉が生まれ出るのを手助けしています。次に筆を執るとき、解答を探す必要はありません。むしろ、あなたの手がぬか床に触れるように、問いそのものに触れてみてください。'
    }
  ],

  // ============================================================================
  // 8. KEYWORDS
  // ============================================================================
  keywords: [
    {
      id: 'kw1',
      fermentation_result_id: 'fr1',
      keyword: '都市の離散',
      description: '死を「崩壊」ではなく、共に住まう者たちが各地へ旅立っていく「離散（ディアスポラ）」として想像してみること。'
    },
    {
      id: 'kw2',
      fermentation_result_id: 'fr1',
      keyword: '沈黙の忠実さ',
      description: '語らないこと・忘れることのなかにある、死者への別種の誠実さ。言葉にしないことで守られる関係。'
    },
    {
      id: 'kw3',
      fermentation_result_id: 'fr1',
      keyword: '胎児への回帰',
      description: '消えゆく者が生の起源に向かって縮小する夢のイメージ。死は終点ではなく、まだ名づけられていない始まりへの折り返し。'
    },
    {
      id: 'kw4',
      fermentation_result_id: 'fr1',
      keyword: 'ぬか床の記憶',
      description: '個人の問いが、繰り返し触れることで徐々に固有の味わいを帯びていくこと。手の常在菌のように、無自覚に受け渡されるもの。'
    },
    {
      id: 'kw5',
      fermentation_result_id: 'fr1',
      keyword: '共異体の食卓',
      description: '自分とは異なるが同輩である存在と、食べる／食べられるという非対称な関係を通じて、対等な親密さを結ぶ場所。'
    }
  ],

  // ============================================================================
  // 9. ENTRY-QUESTION LINKS (for associating questions with entries)
  // ============================================================================
  entryQuestionLinks: [],

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get the latest version string for a question
   * @param {string} questionId
   * @returns {string|null}
   */
  getQuestionString(questionId) {
    const transactions = this.questionTransactions.filter(
      qt => qt.question_id === questionId && qt.is_validated_by_user !== false
    );
    if (transactions.length === 0) return null;
    const latest = transactions.reduce((prev, current) =>
      current.question_version > prev.question_version ? current : prev
    );
    return latest.string;
  },

  /**
   * Get the fermentation result for a question
   * @param {string} questionId
   * @returns {object|null}
   */
  getFermentationForQuestion(questionId) {
    return this.fermentationResults.find(fr => fr.question_id === questionId) || null;
  },

  /**
   * Get extracted snippets for a fermentation result
   * @param {string} fermentationResultId
   * @returns {array}
   */
  getSnippetsForFermentation(fermentationResultId) {
    return this.extractedSnippets.filter(
      snippet => snippet.fermentation_result_id === fermentationResultId
    );
  },

  /**
   * Get keywords for a fermentation result
   * @param {string} fermentationResultId
   * @returns {array}
   */
  getKeywordsForFermentation(fermentationResultId) {
    return this.keywords.filter(
      kw => kw.fermentation_result_id === fermentationResultId
    );
  },

  /**
   * Get letter for a fermentation result
   * @param {string} fermentationResultId
   * @returns {object|null}
   */
  getLetterForFermentation(fermentationResultId) {
    return this.letters.find(letter => letter.fermentation_result_id === fermentationResultId) || null;
  },

  /**
   * Get analysis worksheets for a fermentation result
   * @param {string} fermentationResultId
   * @returns {array}
   */
  getWorksheetsForFermentation(fermentationResultId) {
    return this.analysisWorksheets.filter(
      worksheet => worksheet.fermentation_result_id === fermentationResultId
    );
  },

  /**
   * Get category relations for a fermentation result
   * @param {string} fermentationResultId
   * @returns {array}
   */
  getCategoriesForFermentation(fermentationResultId) {
    return this.categoryRelations.filter(
      category => category.fermentation_result_id === fermentationResultId
    );
  },

  /**
   * Add a new question with a given string
   * @param {string} questionString
   * @returns {object} the new question object
   */
  /**
   * Get only active (non-archived, validated) questions
   * @returns {array}
   */
  getActiveQuestions() {
    return this.questions.filter(q =>
      !q.is_archived && q.is_validated_by_user !== false
    );
  },

  /**
   * Get all transactions for a question, sorted by version
   * @param {string} questionId
   * @returns {array}
   */
  getTransactionsForQuestion(questionId) {
    return this.questionTransactions
      .filter(qt => qt.question_id === questionId)
      .sort((a, b) => a.question_version - b.question_version);
  },

  /**
   * Get the latest validated transaction for a question
   * @param {string} questionId
   * @returns {object|null}
   */
  getLatestTransaction(questionId) {
    const transactions = this.questionTransactions.filter(
      qt => qt.question_id === questionId && qt.is_validated_by_user !== false
    );
    if (transactions.length === 0) return null;
    return transactions.reduce((prev, current) =>
      current.question_version > prev.question_version ? current : prev
    );
  },

  addQuestion(questionString) {
    const newId = 'q' + Date.now();
    const now = new Date().toISOString();

    const newQuestion = {
      id: newId,
      user_id: 'u1',
      created_at: now,
      updated_at: now,
      is_archived: false,
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    };

    this.questions.push(newQuestion);

    const transactionId = 'qt' + Date.now();
    const newTransaction = {
      id: transactionId,
      question_id: newId,
      string: questionString,
      question_version: 1,
      created_at: now,
      updated_at: now,
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    };

    this.questionTransactions.push(newTransaction);
    this.saveToStorage();

    return newQuestion;
  },

  /**
   * Update a question's text (creates a new transaction)
   * @param {string} questionId
   * @param {string} newString
   * @returns {object} the new transaction
   */
  updateQuestion(questionId, newString) {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) return null;

    const now = new Date().toISOString();
    question.updated_at = now;

    const existingTransactions = this.questionTransactions.filter(
      qt => qt.question_id === questionId
    );
    const maxVersion = existingTransactions.reduce(
      (max, qt) => Math.max(max, qt.question_version), 0
    );

    const newTransaction = {
      id: 'qt' + Date.now(),
      question_id: questionId,
      string: newString,
      question_version: maxVersion + 1,
      created_at: now,
      updated_at: now,
      is_validated_by_user: true,
      is_proposed_by_oryzae: false
    };

    this.questionTransactions.push(newTransaction);
    this.saveToStorage();
    return newTransaction;
  },

  /**
   * Archive a question
   * @param {string} questionId
   */
  archiveQuestion(questionId) {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) return;
    question.is_archived = true;
    question.updated_at = new Date().toISOString();
    this.saveToStorage();
  },

  /**
   * Unarchive (restore) a question
   * @param {string} questionId
   */
  unarchiveQuestion(questionId) {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) return;
    question.is_archived = false;
    question.updated_at = new Date().toISOString();
    this.saveToStorage();
  },

  /**
   * Link a question to an entry
   * @param {string} entryId
   * @param {string} questionId
   */
  linkQuestionToEntry(entryId, questionId) {
    // Check if link already exists
    const exists = this.entryQuestionLinks.some(
      link => link.entry_id === entryId && link.question_id === questionId
    );

    if (!exists) {
      this.entryQuestionLinks.push({
        entry_id: entryId,
        question_id: questionId
      });
      this.saveToStorage();
    }
  },

  /**
   * Unlink a question from an entry
   * @param {string} entryId
   * @param {string} questionId
   */
  unlinkQuestionFromEntry(entryId, questionId) {
    this.entryQuestionLinks = this.entryQuestionLinks.filter(
      link => !(link.entry_id === entryId && link.question_id === questionId)
    );
    this.saveToStorage();
  },

  /**
   * Get all questions linked to an entry
   * @param {string} entryId
   * @returns {array}
   */
  getQuestionsForEntry(entryId) {
    const linkedIds = this.entryQuestionLinks
      .filter(link => link.entry_id === entryId)
      .map(link => link.question_id);

    return this.questions.filter(q => linkedIds.includes(q.id));
  },

  /**
   * Get all questions with their current strings
   * @returns {array}
   */
  getAllQuestions() {
    return this.getActiveQuestions().map(question => ({
      ...question,
      current_string: this.getQuestionString(question.id)
    }));
  },

  /**
   * Get ALL questions including archived (for timeline)
   * @returns {array}
   */
  getAllQuestionsIncludingArchived() {
    return this.questions.map(question => ({
      ...question,
      current_string: this.getQuestionString(question.id)
    }));
  },

  /**
   * Save data to localStorage
   */
  saveToStorage() {
    const data = {
      questions: this.questions,
      questionTransactions: this.questionTransactions,
      entryQuestionLinks: this.entryQuestionLinks
    };
    localStorage.setItem('oryzae_data', JSON.stringify(data));
  },

  /**
   * Load data from localStorage
   */
  loadFromStorage() {
    const saved = localStorage.getItem('oryzae_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.questions) this.questions = data.questions;
        if (data.questionTransactions) this.questionTransactions = data.questionTransactions;
        if (data.entryQuestionLinks) this.entryQuestionLinks = data.entryQuestionLinks;
      } catch(e) {
        console.warn('Failed to load saved data:', e);
      }
    }
  }
};

// Load saved data on startup
OryzaeData.loadFromStorage();

// Export for use in modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OryzaeData;
}
