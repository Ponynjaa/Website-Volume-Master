(async () => {
	// only execute the script once
	if (window.hasRun) {
		return;
	}

	window.hasRun = true;

	const storage = browser.storage.local;
	const volumes = await storage.get('volumes') ?? {};

	// listen for changes to url in any tab
	browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
		if (changeInfo.url) {
			const host = getHost(changeInfo.url);

			// when a volume for the host has been saved apply that volume to the tab
			if (volumes[host]) {
				adjustVolume(tabId, volumes[host]);
			}
		}
	});

	// saves the gain nodes for each tab
	// for better performance
	const tabGainNodes = new Map();

	const debouncedSaveVolumes = debounce(saveVolumes, 2000);

	/**
	 * Adjusts the volume of the given tab to the given volume
	 * @param {number} tabId
	 * @param {number} volume 0 = muted; 1 = default
	 * @param {string} [host] host of tab if volume should be saved
	 */
	async function adjustVolume(tabId, volume = 1, host) {
		let hasGainNodes = tabGainNodes.get(tabId);
		if (!hasGainNodes) {
			// get elements from the current tab
			const result = await browser.scripting.executeScript({
				target: {
					tabId: tabId,
					allFrames: true
				},
				func: () => {
					return Array.from(document.body.querySelectorAll('video, audio')).map((mediaElement) => {
						const audioContext = new AudioContext();
						const source = audioContext.createMediaElementSource(mediaElement);
						const gainNode = audioContext.createGain();
						source.connect(gainNode);
						gainNode.connect(audioContext.destination);

						window.gainNodes = window.gainNodes ?? new Set();
						window.gainNodes.add(gainNode);
					}).length > 0;
				}
			});
			hasGainNodes = result.some((r) => r.result);

			console.log(hasGainNodes);

			tabGainNodes.set(tabId, hasGainNodes);
		}

		// Adjust gain value using a new script
		await browser.scripting.executeScript({
			target: { tabId: tabId, allFrames: true },
			func: (volume) => {
				window.gainNodes?.forEach((gainNode) => {
					gainNode.gain.value = volume;
				});
			},
			args: [volume]
		});

		// may save volume for host
		if (host) {
			debouncedSaveVolumes(volume, host);
		}
	}

	async function saveVolumes(volume, host) {
		volumes[host] = volume;
		await storage.set({ 'volumes': volumes });

		console.log('saved settings.');
	}

	function debounce (callback, wait) {
		let timeoutId;
		return (...args) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				callback(...args);
			}, wait);
		};
	}

	/**
	 * Retrieves the host + port for a FQDN
	 * @param {string} url
	 */
	function getHost(url) {
		return new URL(url).host;
	}

	browser.runtime.onMessage.addListener((message) => {
		if (message.command === 'adjustVolume') {
			adjustVolume(message.tabId, message.volume, message.host);
		}
	});
})();
