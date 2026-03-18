/**
 * 金山词霸词典爬虫引擎
 *
 * URL: https://www.iciba.com/word?w=单词
 */

import {
    getText,
    handleNoResult,
    handleNetWorkError,
    DictSearchResult,
    fetchDirtyDOM
} from '../helpers';

const HOST = 'https://www.iciba.com';

export interface IcibaResult {
    word: string;
    prons: Array<{
        phsym: string;
        url: string;
    }>;
    parts: Array<{
        part: string;
        means: string[];
    }>;
    sentences: Array<{
        en: string;
        cn: string;
        from?: string;
    }>;
    collins?: Array<{
        def: string;
        tran: string;
        posp: string;
        examples?: Array<{
            ex: string;
            tran: string;
        }>;
    }>;
}

export const search = async (text: string) => {
    return fetchDirtyDOM(
        `https://www.iciba.com/word?w=${encodeURIComponent(text)}`
    )
        .catch(handleNetWorkError)
        .then(doc => handleDOM(doc))
        .catch(handleNoResult);
};

function handleDOM(doc: DocumentFragment): DictSearchResult<IcibaResult> | null {
    const result: IcibaResult = {
        word: '',
        prons: [],
        parts: [],
        sentences: [],
    };

    const audio: { uk?: string; us?: string } = {};

    // 从 __NEXT_DATA__ JSON 数据中提取所有信息
    const $script = doc.querySelector('script#__NEXT_DATA__');

    if ($script) {
        try {
            const json = JSON.parse($script.textContent || '');
            const wordInfo = json?.props?.pageProps?.initialReduxState?.word?.wordInfo;

            if (!wordInfo) {
                return null;
            }

            // 提取单词
            result.word = wordInfo.baesInfo?.word || '';

            // 提取音标
            if (wordInfo.baesInfo?.symbols) {
                wordInfo.baesInfo.symbols.forEach((symbol: any) => {
                    if (symbol.ph_en) {
                        const url = `https://res.iciba.com/resource/amp3/0/0/${encodeURIComponent(result.word)}.mp3`;
                        result.prons.push({
                            phsym: `英 [${symbol.ph_en}]`,
                            url
                        });
                        audio.uk = url;
                    }
                    if (symbol.ph_am) {
                        const url = `https://res.iciba.com/resource/amp3/1/0/${encodeURIComponent(result.word)}.mp3`;
                        result.prons.push({
                            phsym: `美 [${symbol.ph_am}]`,
                            url
                        });
                        audio.us = url;
                    }
                });
            }

            // 提取释义
            if (wordInfo.baesInfo?.parts) {
                wordInfo.baesInfo.parts.forEach((part: any) => {
                    if (part.part && part.means) {
                        result.parts.push({
                            part: part.part,
                            means: Array.isArray(part.means) ? part.means : [part.means]
                        });
                    }
                });
            }

            // 提取例句
            if (wordInfo.sentenseList && Array.isArray(wordInfo.sentenseList)) {
                wordInfo.sentenseList.forEach((sentence: any) => {
                    if (sentence.orig && sentence.trans) {
                        result.sentences.push({
                            en: sentence.orig,
                            cn: sentence.trans,
                            from: sentence.src || ''
                        });
                    }
                });
            }

            // 从 new_sentence 提取更详细的例句
            if (wordInfo.new_sentence && Array.isArray(wordInfo.new_sentence)) {
                wordInfo.new_sentence.forEach((category: any) => {
                    if (category.sentences && Array.isArray(category.sentences)) {
                        category.sentences.forEach((sentence: any) => {
                            if (sentence.en && sentence.cn) {
                                // 避免重复添加
                                const exists = result.sentences.some(s => s.en === sentence.en);
                                if (!exists) {
                                    result.sentences.push({
                                        en: sentence.en,
                                        cn: sentence.cn,
                                        from: sentence.from || ''
                                    });
                                }
                            }
                        });
                    }
                });
            }

            // 提取柯林斯释义
            if (wordInfo.collins && wordInfo.collins[0]?.entry) {
                result.collins = [];
                wordInfo.collins[0].entry.forEach((entry: any) => {
                    const item = {
                        def: entry.def || '',
                        tran: entry.tran || '',
                        posp: entry.posp || '',
                        examples: [] as Array<{ ex: string; tran: string }>
                    };
                    if (entry.example && Array.isArray(entry.example)) {
                        entry.example.forEach((ex: any) => {
                            item.examples.push({
                                ex: ex.ex || '',
                                tran: ex.tran || '',
                            });
                        });
                    }
                    result.collins!.push(item);
                });
            }

        } catch (e) {
            console.warn('Iciba: Failed to parse __NEXT_DATA__:', e);
        }
    }

    // 如果从 JSON 没有获取到数据，尝试从 DOM 中提取
    if (!result.word) {
        result.word = getText(doc, '.Mean_word__hwr_g') ||
                      getText(doc, '.WordAlert_word__1LxdV') ||
                      getText(doc, 'h1');
    }

    if (result.prons.length === 0) {
        doc.querySelectorAll('.Mean_symbols__fpCmS li, .BaseSymbol_symbol__3HsFN li').forEach($li => {
            const text = $li.textContent || '';
            const match = text.match(/(英|美|UK|US)\s*\[?([^\]]+)\]?/i);
            if (match) {
                const type = match[1] === '英' || match[1] === 'UK' ? '英' : '美';
                const phsym = `[${match[2]}]`;
                const url = type === '英'
                    ? `https://res.iciba.com/resource/amp3/0/0/${encodeURIComponent(result.word)}.mp3`
                    : `https://res.iciba.com/resource/amp3/1/0/${encodeURIComponent(result.word)}.mp3`;
                result.prons.push({ phsym: `${type} ${phsym}`, url });
                if (type === '英') audio.uk = url;
                else audio.us = url;
            }
        });
    }

    if (result.parts.length === 0) {
        doc.querySelectorAll('.Mean_part__UI9M6 li, .Mean_parts__3WRPQ li').forEach($li => {
            const part = getText($li, 'i, span.prop') || '';
            const means: string[] = [];
            $li.querySelectorAll('div span, span.mean').forEach($span => {
                const mean = $span.textContent?.trim();
                if (mean) means.push(mean);
            });
            if (part || means.length > 0) {
                result.parts.push({ part, means });
            }
        });
    }

    if (result.sentences.length === 0) {
        doc.querySelectorAll('.NormalSentence_sentence__Jr9aj, .SentenceSentence_sentence__2FkHu').forEach($sentence => {
            const $en = $sentence.querySelector('.NormalSentence_en__BKdCu, .SentenceSentence_en__2TRBo');
            const $cn = $sentence.querySelector('.NormalSentence_cn__gyUtC, .SentenceSentence_cn__1S4fD');
            const $from = $sentence.querySelector('.NormalSentence_from__cMXrW, .SentenceSentence_from__1dQn6');

            if ($en && $cn) {
                result.sentences.push({
                    en: $en.textContent?.trim() || '',
                    cn: $cn.textContent?.trim() || '',
                    from: $from?.textContent?.trim() || '',
                });
            }
        });
    }

    if (result.word || result.parts.length > 0) {
        return { result, audio };
    }
    return null;
}