import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	WorkspaceLeaf,
} from "obsidian";
import * as https from "https";
import * as fs from "fs";
import { Configuration, OpenAIApi, CreateImageRequestSizeEnum } from "openai";
// Remember to rename these classes and interfaces!

interface Settings {
	apikey: string;
	max_tokens: number;
	temperature: number;
	presence_penalty: number;
	frequency_penalty: number;
}

const DEFAULT_SETTINGS: Settings = {
	apikey: "default",
	max_tokens: 500,
	temperature: 0.8,
	presence_penalty: 1,
	frequency_penalty: 1,
};

export default class ChatMD extends Plugin {
	settings: Settings;

	async onload() {
		console.log("loading chatmd");
		await this.loadSettings();

		this.registerView("chatmd", (leaf) => {
			return new ChatMDView(leaf);
		});

		this.addRibbonIcon("dice", "Chat MD", () => {
			loadSidebar.call(this);
		});

		this.addRibbonIcon("dice", "Generate Image", () => {
			console.log("Clicked");
			const config = {
				apikey: this.settings.apikey,
				size: 256
			};
			getImage("Dog", config, async (data) => {
				// Get image from data (url)
				const image = await fetch(data);
				const blob = await image.blob();
				console.log(blob.type);
				// Create new file

			});
		});

		this.addCommand({
			id: "chatmd",
			name: "Ask Chat GPT",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				(async () => {
					let prompt = editor.getSelection();
					if (prompt == "") {
						prompt = editor.getLine(editor.getCursor().line);
						editor.replaceRange(
							"",
							{ line: editor.getCursor().line, ch: 0 },
							{ line: editor.getCursor().line, ch: prompt.length }
						);
					} else {
						editor.replaceSelection("");
					}
					await getText(
						[
							{
								role: "system",
								content:
									"You are an ai note taking assistant. Format your responses using markdown",
							},
							{ role: "user", content: prompt },
						],
						this.settings,
						(data) => {
							const lines = data.split("\n");
							lines.forEach((line) => {
								if (line.startsWith("data: ")) {
									if (line.includes("[DONE]")) return;
									const message = JSON.parse(
										line.substring(6)
									);
									if (message.choices[0].delta.content) {
										editor.replaceSelection(
											message.choices[0].delta.content
										);
									}
								}
							});
						}
					);
				})();
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "A",
				},
			],
		});

		this.addCommand({
			id: "chatmd-sidebar",
			name: "Open Chat MD Sidebar",
			callback: () => {
				loadSidebar.call(this);
			},
		});

		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

async function loadSidebar(this: ChatMD) {
	const leaves = this.app.workspace.getLeavesOfType("chatmd");
	if (leaves.length > 0) {
		this.app.workspace.revealLeaf(leaves[0]);
	} else {
		// eslint-disable-next-line prefer-const
		let leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			leaf.setViewState({
				type: "chatmd",
				active: true,
			});
		}
	}
}

async function getText(
	prompt: { role: string; content: string }[],
	chatOptions: {
		apikey: string;
		max_tokens: number;
		temperature: number;
		presence_penalty: number;
		frequency_penalty: number;
	},
	callback: { (data: string): void; (arg0: string): void }
) {
	const postData = JSON.stringify({
		model: "gpt-3.5-turbo",
		messages: prompt,
		stream: true,
		max_tokens: chatOptions.max_tokens,
		temperature: chatOptions.temperature,
		presence_penalty: chatOptions.presence_penalty,
		frequency_penalty: chatOptions.frequency_penalty,
	});

	const options = {
		hostname: "api.openai.com",
		path: "/v1/chat/completions",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${chatOptions.apikey}`,
			"Content-Length": postData.length,
		},
	};

	const req = https.request(options, (res) => {
		res.on("data", (chunk) => {
			callback(chunk.toString());
		});
	});

	req.on("error", (error) => {
		console.error("Error sending request:", error);
	});

	req.write(postData);
	req.end();
}

async function getImage(
	prompt: string,
	config: { apikey: string; size: number },
	callback: { (data: string): void; (arg0: string): void }
) {
	console.log("Getting Image");
	const configuration = new Configuration({
		apiKey: config.apikey,
	});
	let size: CreateImageRequestSizeEnum = CreateImageRequestSizeEnum._256x256;
	if (config.size >= 1024) size = CreateImageRequestSizeEnum._1024x1024;
	else if (config.size >= 512) size = CreateImageRequestSizeEnum._512x512;
	const openai = new OpenAIApi(configuration);
	const response = await openai.createImage({
		prompt: prompt,
		n: 1,
		response_format: "url",
		size: size,
	});
	if (response.data.data[0].url) {
		callback(response.data.data[0].url as string);
	}
	// const data = JSON.stringify({
	// 	prompt: prompt,
	// 	n: 1,
	// 	size: `${config.size}x${config.size}`,
	// });

	// const xhr = new XMLHttpRequest();
	// xhr.withCredentials = true;

	// xhr.addEventListener("readystatechange", function () {
	// 	if (this.readyState === this.DONE) {
	// 		callback(this.responseText);
	// 	}
	// });

	// xhr.open("POST", "https://api.openai.com/v1/images/generations");
	// xhr.setRequestHeader("Content-Type", "application/json");
	// xhr.setRequestHeader("Access-Control-Allow-Origin", "*")
	// xhr.setRequestHeader("Authorization", `Bearer ${config.apikey}`);

	// xhr.send(data);
}

class ChatMDView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.icon = "dice";
		this.containerEl.empty();
		this.containerEl
			.createEl("h1", { text: this.getDisplayText() })
			.addClass("chatmd-header");
		const container = this.containerEl.createDiv(
			"chatmd-message-container"
		);
		for (let index = 0; index < 10; index++) {
			const msg = container.createEl("p", {
				text: "Welcome to Chat MD!",
			});
			msg.setAttribute("data-role", "ai");
			msg.addClass("chatmd-message");
			const msg2 = container.createEl("p", { text: "This is the USER!" });
			msg2.setAttribute("data-role", "user");
			msg2.addClass("chatmd-message");
		}
		const inputForm = this.containerEl.createEl("form");
		inputForm.addClass("chatmd-input-form");
		inputForm
			.createEl("button", { text: "New Chat" })
			.addClass("chatmd-new-chat");
		inputForm
			.createEl("input", { text: "Input Test" })
			.addClass("chatmd-input");
		inputForm.createEl("button", { text: "Send" }).addClass("chatmd-send");
	}

	getViewType(): string {
		return "chatmd";
	}

	getDisplayText(): string {
		return "Chat MD";
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: ChatMD;

	constructor(app: App, plugin: ChatMD) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for Chat MD." });

		new Setting(containerEl)
			.setName("API KEY")
			.setDesc("Enter Your OpenAI API Key")
			.addText((text) =>
				text
					.setPlaceholder("API Key")
					.setValue(this.plugin.settings.apikey)
					.onChange(async (value) => {
						this.plugin.settings.apikey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Enter Max Tokens | Max 4096")
			.addText((text) =>
				text
					.setPlaceholder("Max Tokens")
					.setValue(this.plugin.settings.max_tokens.toString())
					.onChange(async (value) => {
						// Check if input is valid
						if (parseInt(value) > 4096) {
							new Notice(
								"Max Tokens cannot be greater than 4096"
							);
							return;
						} else if (parseInt(value) == 0) {
							new Notice("Max Tokens cannot be 0");
							return;
						}
						// Update Slider
						const settingItem =
							containerEl.findAll(".setting-item")[1];
						const input =
							settingItem.querySelector<HTMLInputElement>(
								"input[type=range]"
							);
						if (input) input.value = value.toString();
						// Update setting value
						this.plugin.settings.max_tokens = parseInt(value);
						await this.plugin.saveSettings();
					})
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 4096, 1)
					.setValue(this.plugin.settings.max_tokens)
					.setDynamicTooltip()
					.onChange(async (value) => {
						// Update Text Input
						const settingItem =
							containerEl.findAll(".setting-item")[1];
						const input =
							settingItem.querySelector<HTMLInputElement>(
								"input[type=text]"
							);
						if (input) input.value = value.toString();
						// Update setting value
						this.plugin.settings.max_tokens = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Enter Temperature | 0 - 1")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.1)
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Presence Penalty")
			.setDesc("Enter Presence Penalty | 0 - 2")
			.addSlider((slider) =>
				slider
					.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.presence_penalty)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.presence_penalty = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Frequency Penalty")
			.setDesc("Enter Frequency Penalty | 0 - 2")
			.addSlider((slider) =>
				slider
					.setLimits(0, 2, 0.1)
					.setValue(this.plugin.settings.frequency_penalty)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.frequency_penalty = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
