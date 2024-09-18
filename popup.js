(async () => {
	const volumes = await browser.storage.local.get('volumes');
	const slider = document.querySelector('input#slider');
	const volumeLabel = document.querySelector('#volume');

	//0 - find currently active tab
	const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });
	const currentTab = currentTabs[0];

	//1 - shouldn't work in devtools tabs etc
	if (!currentTab || currentTab.id === browser.tabs.TAB_ID_NONE) {
		return;
	}

	//2 - initialize slider with saved volume or 100%
	const host = getHost(currentTab.url);
	if (volumes?.volumes?.[host]) {
		const volume = Math.floor(volumes.volumes[host] * 100);
		slider.value = volume;
		volumeLabel.innerHTML = volume + '%';
	} else {
		slider.value = 100;
		volumeLabel.innerHTML = '100%';
	}

	//3 - add handler for change of slider
	slider.addEventListener('input', (_ev) => {
		volumeLabel.innerHTML = slider.value + '%';

		browser.runtime.sendMessage({
			command: 'adjustVolume',
			tabId: currentTab.id,
			volume: slider.value / 100,
			host: host
		});
	});

	/**
	 * Retrieves the host + port for a FQDN
	 * @param {string} url
	 */
	function getHost(url) {
		return new URL(url).host;
	}
})();
