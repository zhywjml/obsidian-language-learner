<template>
    <div id="langr-learn-panel">
        <form class="learn-form" @submit.prevent="submit">
            <!-- 一个单词或短语字符串 -->
            <div class="form-group">
                <label class="form-label">{{ t("Expression") }}</label>
                <input
                    type="text"
                    class="form-input"
                    v-model="model.expression"
                    :placeholder="t('A word or a phrase')"
                />
            </div>
            <!-- 单词或短语的含义(精简) -->
            <div class="form-group">
                <label class="form-label">{{ t("Meaning") }}</label>
                <textarea
                    class="form-textarea"
                    v-model="model.meaning"
                    :placeholder="t('A short definition')"
                ></textarea>
            </div>
            <!-- 类别，可以是Word或Phrase -->
            <div class="form-group">
                <label class="form-label">{{ t("Type") }}</label>
                <div class="radio-group">
                    <label class="radio-label">
                        <input type="radio" value="WORD" v-model="model.t" />
                        {{ t("Word") }}
                    </label>
                    <label class="radio-label">
                        <input type="radio" value="PHRASE" v-model="model.t" />
                        {{ t("Phrase") }}
                    </label>
                </div>
            </div>
            <!-- 当前单词的学习状态 -->
            <div class="form-group">
                <label class="form-label">{{ t("Status") }}</label>
                <div class="status-buttons">
                    <label
                        v-for="(s, i) in status"
                        :key="i"
                        class="status-btn"
                        :class="{ active: model.status === i }"
                        :style="s.style"
                    >
                        <input type="radio" :value="i" v-model="model.status" />
                        {{ s.text }}
                    </label>
                </div>
            </div>
            <!-- 加一些tag, 可以用来搜索 -->
            <div class="form-group">
                <label class="form-label">{{ t("Tags") }}</label>
                <div class="tags-dropdown" @mouseenter="showTagDropdown = true" @mouseleave="showTagDropdown = false">
                    <div class="tags-trigger">
                        <span v-if="model.tags.length === 0" class="placeholder">{{ t('Input or select some tags') }}</span>
                        <span v-else class="selected-tags">
                            <span v-for="tag in model.tags" :key="tag" class="selected-tag">
                                {{ tag }}
                                <span class="remove-tag" @click.stop="removeTag(tag)">×</span>
                            </span>
                        </span>
                    </div>
                    <div class="dropdown-menu" v-show="showTagDropdown" @mouseenter="showTagDropdown = true" @mouseleave="showTagDropdown = false">
                        <div class="dropdown-section">
                            <div
                                v-for="tag in availableTags"
                                :key="tag"
                                class="dropdown-item checkbox-item"
                                :class="{ checked: model.tags.includes(tag) }"
                                @click="toggleTag(tag)"
                            >
                                <span class="checkbox">
                                    <span v-if="model.tags.includes(tag)">✓</span>
                                </span>
                                <span class="tag-text">{{ tag }}</span>
                            </div>
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-section">
                            <div class="dropdown-item create-tag" @click="showCreateTag = true">
                                <span class="plus-icon">+</span>
                                <span>{{ t("Create new tag") }}</span>
                            </div>
                            <div v-if="showCreateTag" class="create-tag-form">
                                <input
                                    type="text"
                                    v-model="newTagName"
                                    :placeholder="t('Tag name')"
                                    class="tag-input"
                                    @keydown.enter="createTag"
                                />
                                <button type="button" class="create-btn" @click="createTag">{{ t("Add") }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 可选,可以记多条笔记 -->
            <div class="form-group">
                <label class="form-label">{{ t("Notes") }}</label>
                <div class="dynamic-inputs">
                    <div v-for="(note, index) in model.notes" :key="index" class="dynamic-item">
                        <textarea
                            class="form-textarea"
                            v-model="model.notes[index]"
                            :placeholder="t('Write a new note')"
                        ></textarea>
                        <button type="button" class="remove-btn" @click="removeNote(index)">×</button>
                    </div>
                    <button type="button" class="create-btn" @click="addNote">{{ t("Create") }}</button>
                </div>
            </div>
            <!-- 可选,例句也可以记多条 -->
            <div class="form-group">
                <label class="form-label">{{ t("Sentences") }}</label>
                <div class="dynamic-inputs">
                    <div v-for="(sentence, index) in model.sentences" :key="index" class="sentence-item">
                        <textarea
                            class="form-textarea"
                            v-model="model.sentences[index].text"
                            :placeholder="t('Origin sentence')"
                        ></textarea>
                        <textarea
                            class="form-textarea"
                            v-model="model.sentences[index].trans"
                            :placeholder="t('Translation (Optional)')"
                        ></textarea>
                        <textarea
                            class="form-textarea"
                            v-model="model.sentences[index].origin"
                            :placeholder="t('Origin (Optional)')"
                        ></textarea>
                        <button type="button" class="remove-btn" @click="removeSentence(index)">×</button>
                    </div>
                    <button type="button" class="create-btn" @click="addSentence">{{ t("Create") }}</button>
                </div>
            </div>
            <!-- 提交按钮 -->
            <div class="form-actions">
                <button type="submit" class="submit-btn" :class="{ success: successing, error: failing }" :disabled="submitLoading">
                    <span v-if="successing" class="icon success-icon">✓</span>
                    <span v-if="failing" class="icon error-icon">✕</span>
                    {{ t("Submit") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
import { Notice } from "obsidian";
import {
	ref,
	onMounted,
	onUnmounted,
	getCurrentInstance,
	computed,
} from "vue";

import { ExpressionInfo, Sentence } from "@/db/interface";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import { LearnPanelView } from "./LearnPanelView";
import { ReadingView } from "./ReadingView";
import Plugin from "@/plugin";
import { search } from "@/dictionary/youdao/engine";
import store from "@/store";

const view: LearnPanelView =
	getCurrentInstance().appContext.config.globalProperties.view;
const plugin: Plugin =
	getCurrentInstance().appContext.config.globalProperties.plugin;

// 表单数据
let model = ref<ExpressionInfo>({
	expression: null,
	meaning: null,
	status: 0,
	t: "WORD",
	tags: [],
	notes: [],
	sentences: [],
});

// 单词状态样式
const status = [
	{ text: t("Ignore"), style: "" },
	{ text: t("Learning"), style: "background-Color: #ff980055" },
	{ text: t("Familiar"), style: "background-Color: #ffeb3c55" },
	{ text: t("Known"), style: "background-Color: #9eda5855" },
	{ text: t("Learned"), style: "background-Color: #4cb05155" },
];

// 动态添加/删除笔记
function addNote() {
	model.value.notes.push("");
}

function removeNote(index: number) {
	model.value.notes.splice(index, 1);
}

// 动态添加/删除例句
function onCreateSentence() {
	return {
		text: "",
		trans: "",
		origin: "",
	};
}

function addSentence() {
	model.value.sentences.push(onCreateSentence());
}

function removeSentence(index: number) {
	model.value.sentences.splice(index, 1);
}

// 标签相关
let availableTags = ref<string[]>([]);
let showTagDropdown = ref(false);
let showCreateTag = ref(false);
let newTagName = ref("");

// 加载所有可用标签
async function loadTags() {
	availableTags.value = await plugin.db.getTags();
}

// 初始化时加载标签
onMounted(() => {
	loadTags();
});

// 切换标签选中状态
function toggleTag(tag: string) {
	const index = model.value.tags.indexOf(tag);
	if (index === -1) {
		model.value.tags.push(tag);
	} else {
		model.value.tags.splice(index, 1);
	}
}

// 移除已选标签
function removeTag(tag: string) {
	const index = model.value.tags.indexOf(tag);
	if (index !== -1) {
		model.value.tags.splice(index, 1);
	}
}

// 创建新标签
function createTag() {
	const name = newTagName.value.trim();
	if (name && !availableTags.value.includes(name)) {
		availableTags.value.push(name);
		model.value.tags.push(name);
	}
	newTagName.value = "";
	showCreateTag.value = false;
}

// 提交信息到数据库的加载状态
let successing = ref(false);
async function success() {
	successing.value = true;
	await sleep(2000)
	successing.value = false;
}
let failing = ref(false);
async function fail() {
	failing.value = true;
	await sleep(2000)
	failing.value = false;
}

let submitLoading = ref(false);

async function submit() {
	// 表单内容检查
	if (!model.value.expression) {
		new Notice(t("Expression is empty!"));
		return;
	}
	if (!model.value.meaning) {
		new Notice(t("Meaning is empty!"));
		return;
	}
	if (
		model.value.expression.trim().split(" ").length > 1 &&
		model.value.t === "WORD"
	) {
		new Notice(t("It looks more like a PHRASE than a WORD"));
		return;
	}

	submitLoading.value = true;
	let data = JSON.parse(JSON.stringify(model.value));
	(data as any).expression = (data as any).expression.trim().toLowerCase();
	// 超过1条例句时，sentences中的对象会变成Proxy，尚不知原因，因此用JSON转换一下
	let statusCode = await plugin.db.postExpression(data);
	submitLoading.value = false;

	if (statusCode !== 200) {
		new Notice("Submit failed");
		console.warn("Submit failed, please check server status");
		fail();
		return;
	}
	
	success()

	dispatchEvent(
		new CustomEvent("obsidian-langr-refresh", {
			detail: {
				expression: model.value.expression,
				type: model.value.t,
				status: model.value.status,
			},
		})
	);
	dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

	//自动刷新数据库
	if (plugin.settings.auto_refresh_db) {
		// setTimeout(() => {
		plugin.refreshTextDB();
		// }, 0);
	}
}

// 查询词汇时自动填充新词表单
useEvent(window, "obsidian-langr-search", async (evt: CustomEvent) => {
	let selection = evt.detail.selection as string;
	let expr = await plugin.db.getExpression(selection);

	let exprType = "WORD";
	if (selection.trim().contains(" ")) {
		exprType = "PHRASE";
	}

	let target = evt.detail.target as HTMLElement;

	let sentenceText = "";
	let storedSen: Sentence = null;
	let defaultOrigin: string = null;
	let filledTrans = null;

	if (target) {
		let sentenceEl = target.parentElement.hasClass("stns")
			? target.parentElement
			: target.parentElement.parentElement;
		sentenceText = sentenceEl.textContent;

		storedSen = await plugin.db.tryGetSen(sentenceText);

		let reading = view.app.workspace.getActiveViewOfType(ReadingView);

		if (reading) {
			let presetOrigin = view.app.metadataCache.getFileCache(reading.file)
				.frontmatter["langr-origin"];
			defaultOrigin = presetOrigin ? presetOrigin : reading.file.name;
		}

		if (plugin.settings.use_machine_trans) {
			try {
				let res = await search(sentenceText);
				if (res && (res.result as any).translation) {
					let html = (res.result as any).translation as string;
					filledTrans =
						html
							.match(/<p>([^<>]+)<\/p>/g)[1]
							?.match(/<p>(.*)<\/p>/)[1] ?? null;
				}
			} catch (e) {
				filledTrans = "";
			}
		}
	}

	if (expr) {
		if (sentenceText) {
			if (!storedSen) {
				expr.sentences = expr.sentences.concat({
					text: sentenceText,
					trans: filledTrans,
					origin: defaultOrigin,
				});
			} else {
				let added = expr.sentences.find(
					(sen) => sen.text === sentenceText
				);
				if (!added) {
					expr.sentences = expr.sentences.concat(storedSen);
				}
			}
		}
		model.value = expr;
		return;
	} else {
		if (!target) {
			model.value = {
				expression: selection,
				meaning: "",
				status: 1,
				t: exprType,
				tags: [],
				notes: [],
				sentences: [],
			};
			return;
		}

		model.value = {
			expression: selection,
			meaning: "",
			status: 1,
			t: exprType,
			tags: [],
			notes: [],
			sentences: storedSen
				? [storedSen]
				: [
					{
						text: sentenceText,
						trans: filledTrans,
						origin: defaultOrigin,
					},
				],
		};
	}
});

</script>

<style lang="scss">
#langr-learn-panel {
	padding-bottom: 18px;

	.learn-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-label {
		font-weight: bold;
		font-size: 14px;
		color: var(--text-normal);
	}

	.form-input,
	.form-textarea,
	.form-select {
		padding: 6px 8px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-normal);
		font-size: 12px;
		font-family: inherit;

		&:focus {
			outline: none;
			border-color: var(--interactive-accent);
		}
	}

	.form-textarea {
		resize: vertical;
		min-height: 40px;
	}

	.form-select {
		min-height: 60px;
	}

	.tag-input {
		margin-top: 4px;
	}

	.tags-dropdown {
		position: relative;

		.tags-trigger {
			min-height: 32px;
			padding: 4px 8px;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;

			&:hover {
				border-color: var(--interactive-accent);
			}

			.placeholder {
				color: var(--text-muted);
				font-size: 12px;
			}

			.selected-tags {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
			}

			.selected-tag {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px 6px;
				background: var(--interactive-accent);
				border-radius: 4px;
				color: var(--text-on-accent);
				font-size: 11px;

				.remove-tag {
					cursor: pointer;
					font-size: 12px;
					opacity: 0.7;

					&:hover {
						opacity: 1;
					}
				}
			}
		}

		.dropdown-menu {
			position: absolute;
			top: 100%;
			left: 0;
			min-width: 200px;
			max-height: 200px;
			overflow-y: auto;
			padding: 4px 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 6px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			z-index: 100;
			margin-top: 2px;

			.dropdown-divider {
				height: 1px;
				background: var(--background-modifier-border);
				margin: 4px 0;
			}

			.dropdown-section {
				max-height: 140px;
				overflow-y: auto;
			}

			.dropdown-item {
				padding: 6px 12px;
				font-size: 12px;
				color: var(--text-normal);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;

				&:hover {
					background: var(--background-secondary);
				}

				&.checkbox-item {
					.checkbox {
						width: 16px;
						height: 16px;
						border: 1px solid var(--background-modifier-border);
						border-radius: 3px;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 10px;
						color: var(--interactive-accent);
						background: var(--background-primary);
					}

					&.checked .checkbox {
						background: var(--interactive-accent);
						border-color: var(--interactive-accent);
						color: var(--text-on-accent);
					}

					.tag-text {
						flex: 1;
					}
				}

				&.create-tag {
					color: var(--interactive-accent);

					.plus-icon {
						width: 16px;
						height: 16px;
						border: 1px dashed var(--interactive-accent);
						border-radius: 3px;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 12px;
						font-weight: bold;
					}

					&:hover {
						background: var(--background-secondary);
					}
				}
			}

			.create-tag-form {
				padding: 8px 12px;
				display: flex;
				gap: 8px;

				.tag-input {
					flex: 1;
					padding: 4px 8px;
					background: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					color: var(--text-normal);
					font-size: 11px;
					margin-top: 0;

					&:focus {
						outline: none;
						border-color: var(--interactive-accent);
					}
				}

				.create-btn {
					padding: 4px 10px;
					background: var(--interactive-accent);
					border: none;
					border-radius: 4px;
					color: var(--text-on-accent);
					font-size: 11px;
					cursor: pointer;

					&:hover {
						opacity: 0.9;
					}
				}
			}
		}
	}

	.radio-group {
		display: flex;
		gap: 12px;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--text-normal);
		cursor: pointer;
	}

	.status-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.status-btn {
		padding: 4px 8px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		font-size: 11px;
		color: var(--text-normal);
		cursor: pointer;
		transition: all 0.15s ease;

		input {
			display: none;
		}

		&.active {
			border-color: var(--interactive-accent);
			box-shadow: 0 0 0 1px var(--interactive-accent);
		}

		&:hover {
			background: var(--background-secondary-alt);
		}
	}

	.dynamic-inputs {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.dynamic-item,
	.sentence-item {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;

		.form-textarea {
			width: 100%;
		}
	}

	.remove-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 20px;
		height: 20px;
		padding: 0;
		background: var(--background-modifier-border);
		border: none;
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			background: #DE5959;
			color: white;
		}
	}

	.create-btn {
		padding: 6px 12px;
		background: var(--background-secondary);
		border: 1px dashed var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 12px;

		&:hover {
			border-color: var(--interactive-accent);
			color: var(--interactive-accent);
		}
	}

	.form-actions {
		margin-top: 8px;
	}

	.submit-btn {
		width: 100%;
		padding: 8px 16px;
		background: var(--interactive-accent);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;

		&:hover:not(:disabled) {
			opacity: 0.9;
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		&.success {
			background: #4cb051;
		}

		&.error {
			background: #DE5959;
		}

		.icon {
			font-size: 14px;
		}
	}
}
</style>