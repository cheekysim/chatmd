import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as https from 'https';
// Remember to rename these classes and interfaces!



interface Settings {
	apikey: string;
	max_tokens: number;
	temperature: number;
	presence_penalty: number;
	frequency_penalty: number;
}

const DEFAULT_SETTINGS: Settings = {
	apikey: 'default',
	max_tokens: 500,
	temperature: 0.8,
	presence_penalty: 1,
	frequency_penalty: 1
}

export default class ChatMD extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();
		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.addCommand({
			id: "chatmd",
			name: "Ask Chat GPT",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				(async () => {
					let prompt = editor.getSelection()
					if (prompt == "") {
						prompt = editor.getLine(editor.getCursor().line);
						editor.replaceRange("", {line: editor.getCursor().line, ch: 0}, {line: editor.getCursor().line, ch: prompt.length});
					} else {
						editor.replaceSelection("");
					}
					const options = {
						key: this.settings.apikey,
						max_tokens: this.settings.max_tokens,
						temperature: this.settings.temperature,
						presence_penalty: this.settings.presence_penalty,
						frequency_penalty: this.settings.frequency_penalty
					}
					await getText(prompt, options, (data) => {
						const lines = data.split('\n');
						lines.forEach((line) => {
							if (line.startsWith("data: ")) {
								if (line.includes("[DONE]")) return;
								const message = JSON.parse(line.substring(6));
								if (message.choices[0].delta.content) {
									editor.replaceSelection(message.choices[0].delta.content);
								}
							}
						});
				});})();
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "A"
				}
			]
		})

		this.addSettingTab(new SettingsTab(this.app, this));
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


async function getText(prompt: string,
	chatOptions: { key: string; max_tokens: number; temperature: number; presence_penalty: number; frequency_penalty: number; },
	callback: { (data: string): void; (arg0: string): void; })
	{
		const postData = JSON.stringify({
		model: 'gpt-3.5-turbo',
		messages: [{ role: 'user', content: prompt }],
		stream: true,
		max_tokens: chatOptions.max_tokens,
		temperature: chatOptions.temperature,
		presence_penalty: chatOptions.presence_penalty,
		frequency_penalty: chatOptions.frequency_penalty,
		});

		const options = {
		hostname: 'api.openai.com',
		path: '/v1/chat/completions',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${chatOptions.key}`,
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

class SettingsTab extends PluginSettingTab {
	plugin: ChatMD;

	constructor(app: App, plugin: ChatMD) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Chat MD.'});

		new Setting(containerEl)
			.setName('API KEY')
			.setDesc('Enter Your OpenAI API Key')
			.addText(text => text
				.setPlaceholder('API Key')
				.setValue(this.plugin.settings.apikey)
				.onChange(async (value) => {
					this.plugin.settings.apikey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max Tokens')
			.setDesc('Enter Max Tokens')
			.addText(text => text
				.setPlaceholder('Max Tokens')
				.setValue(this.plugin.settings.max_tokens.toString())
				.onChange(async (value) => {
					if (parseInt(value) > 4096) return;
					this.plugin.settings.max_tokens = parseInt(value);
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Enter Temperature')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.temperature)
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Presence Penalty')
			.setDesc('Enter Presence Penalty')
			.addSlider(slider => slider
				.setLimits(0, 2, 0.1)
				.setValue(this.plugin.settings.presence_penalty)
				.onChange(async (value) => {
					this.plugin.settings.presence_penalty = value;
					await this.plugin.saveSettings();
				}
			));

		new Setting(containerEl)
			.setName('Frequency Penalty')
			.setDesc('Enter Frequency Penalty')
			.addSlider(slider => slider
				.setLimits(0, 2, 0.1)
				.setValue(this.plugin.settings.frequency_penalty)
				.onChange(async (value) => {
					this.plugin.settings.frequency_penalty = value;
					await this.plugin.saveSettings();
				}
			));
	}}