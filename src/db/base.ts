import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    HeatmapStats
} from "./interface";

/**
 * 数据库抽象基类
 *
 * 定义所有数据库操作接口，支持两种实现：
 * - LocalDb: 本地 IndexedDB 存储
 * - WebDb: 远程服务器 API
 */
abstract class DbProvider {
    abstract open(): Promise<void>;
    abstract close(): void;
    // 在文章中寻找之前记录过的单词和词组
    abstract getStoredWords(payload: ArticleWords): Promise<WordsPhrase>;
    // 查询单个单词/词组的全部信息
    abstract getExpression(expression: string): Promise<ExpressionInfo>;
    //获取一批单词的简略信息
    abstract getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]>;
    // 某一时间之后添加的全部单词
    abstract getExpressionAfter(time: string): Promise<ExpressionInfo[]>;
    // 获取全部单词的简略信息
    abstract getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]>;
    // 发送单词信息到数据库保存
    abstract postExpression(payload: ExpressionInfo): Promise<number>;
    // 获取所有tag
    abstract getTags(): Promise<string[]>;
    // 批量发送单词，全部标记为ignore
    abstract postIgnoreWords(payload: string[]): Promise<void>;
    // 查询一个例句是否已经记录过
    abstract tryGetSen(text: string): Promise<Sentence>;
    // 获取各类单词的个数
    abstract getCount(): Promise<CountInfo>;
    // 获取7天内的统计信息
    abstract countSeven(): Promise<WordCount[]>;
    // 获取热力图数据（指定年份，不传则使用当前年份）
    abstract getHeatmapData(year?: number): Promise<HeatmapStats>;
    // 按日期查询单词
    abstract getExpressionsByDate(date: string): Promise<ExpressionInfo[]>;
    abstract getExpressionsByDateRange(start: string, end: string): Promise<ExpressionInfo[]>;
    // 销毁数据库
    abstract destroyAll(): Promise<void>;
    // 导入数据库
    abstract importDB(data: any): Promise<void>;
    // 导出数据库
    abstract exportDB(): Promise<void>;
}


export default DbProvider;