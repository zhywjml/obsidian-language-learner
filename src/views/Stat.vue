<template>
	<div class="stat-disabled">
		<div class="disabled-message">
			<span class="icon">📊</span>
			<span class="text">{{ t('Statistics') }}</span>
			<span class="sub-text">{{ t('This feature has been temporarily disabled') }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { getCurrentInstance } from "vue";
import { t } from "@/lang/helper";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin;
</script>

<style lang="scss">
.stat-disabled {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	min-height: 300px;
	padding: 20px;

	.disabled-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
		color: var(--text-muted);

		.icon {
			font-size: 48px;
			opacity: 0.5;
		}

		.text {
			font-size: 18px;
			font-weight: 600;
			color: var(--text-normal);
		}

		.sub-text {
			font-size: 13px;
			max-width: 280px;
			opacity: 0.7;
		}
	}
}
</style>
