import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
// import { SSE } from 'sse';
// import axios from 'axios';
import * as https from 'https';
// Remember to rename these classes and interfaces!



interface Settings {
	apikey: string;
}

const DEFAULT_SETTINGS: Settings = {
	apikey: 'default'
}

export default class MyPlugin extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();
		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.addCommand({
			id: "chatmd",
			name: "Ask Chat GPT",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (editor.getSelection() == "") {
					editor.replaceSelection("Please Select Text To Ask Chat GPT");
				} else {
						(async () => {const prompt = editor.getSelection()
						editor.replaceSelection("");
						await getText(prompt, this.settings.apikey, (data) => {
							const lines = data.split('\n');
							lines.forEach((line) => {
								if (line.startsWith("data: ")) {
									if (line.includes("[DONE]")) return;
									const message = JSON.parse(line.substring(6));
									if (message.choices) {
										if (message.choices[0].delta.content) {
											editor.replaceSelection(message.choices[0].delta.content);
										}
									}
								}
							});
							// editor.replaceSelection(data.choices[0].message?.content as string);
						});})();
				}
			}
		})

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


async function getText(prompt: string, key: string, callback: { (data: string): void; (arg0: string): void; }) {
	const postData = JSON.stringify({
	model: 'gpt-3.5-turbo',
	messages: [{ role: 'user', content: prompt }],
	stream: true,
	max_tokens: 100
	});

	const options = {
	hostname: 'api.openai.com',
	path: '/v1/chat/completions',
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${key}`,
		'Content-Length': postData.length
	}
	};

	const req = https.request(options, (res) => {
	res.on('data', (chunk) => {
		callback(chunk.toString())
	});
	});

	req.on('error', (error) => {
	console.error('Error sending request:', error);
	});

	req.write(postData);
	req.end();

}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('API Key')
				.setValue(this.plugin.settings.apikey)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.apikey = value;
					await this.plugin.saveSettings();
				}));
	}}