import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Configuration, OpenAIApi, CreateChatCompletionResponse } from 'openai';
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
							editor.replaceSelection(data.choices[0].message?.content as string);
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


async function getText(prompt: string, key: string, callback: (data: CreateChatCompletionResponse) => void) {
	const config = new Configuration({
		apiKey: key
	})
	const openai = new OpenAIApi(config)
	const completion = openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: [
			{"role": "system", "content": "You are a helpful assistant who provides accurate responses to user requests."},
			{"role": "user", "content": prompt},
		],
		stream: false,
		max_tokens: 500,
		temperature: 0.9,
		stop: "\n",
		frequency_penalty: 0.2,
		top_p: 1,
		n: 1,
	});
	const response = await completion;
	callback(response.data);
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