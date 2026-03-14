/**
 * 播放音频
 */
export function playAudio(src: string) {
    new Audio(src).play();
}