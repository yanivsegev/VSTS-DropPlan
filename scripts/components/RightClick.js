function handleRightClick(event, menuItems) {
	// Prevent the default context menu from appearing
	event.preventDefault();
	if(menuItems.length==0){
		return;
	}
	// Create a new <ul> element for the right-click menu
	const menu = document.createElement('ul');
	menu.classList.add('right-click-menu');

	// Create menu items
	for (const menuItem of menuItems) {
		const item = document.createElement('li');
		item.textContent = menuItem.text;
		item.addEventListener('click', menuItem.onClick);
		menu.appendChild(item);
	}

	// Position the menu at the mouse pointer's coordinates
	menu.style.left = event.pageX + 'px';
	menu.style.top = event.pageY + 'px';

	// Append the menu to the document body
	document.body.appendChild(menu);
}

