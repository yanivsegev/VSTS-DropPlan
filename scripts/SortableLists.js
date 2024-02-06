function SortableList (){
	let _state=[];
	let _currentItem;
	let _callback;

	const validDropTarget =(e) => {
		const draggedItem =document.querySelector(".sortableList .dragging");
		const sourceParent=$(draggedItem).closest(".sortableListContainer")[0]

		const dropTarget= ($(e.target).is(".sortableList") ? e.target : $(e.target).closest(".sortableList")[0]);
		const dropParent=$(dropTarget).closest(".sortableListContainer")[0]

		if(sourceParent==dropParent){
			e.preventDefault();
		}
	}
	const moveItem =(e) => {
		const t0= performance.now();
		const draggedItem =document.querySelector(".sortableList .dragging");
		const sourceParent=$(draggedItem).closest(".sortableListContainer")[0]

		const dropTarget= ($(e.target).is(".sortableList") ? e.target : $(e.target).closest(".sortableList")[0]);
		const dropParent=$(dropTarget).closest(".sortableListContainer")[0];
		const singleItemPerRowAttribute = dropTarget.getAttribute("singleItemPerRow");
		let multipleItemsPerRow=1;
		if(singleItemPerRowAttribute !==null){
			multipleItemsPerRow = (singleItemPerRowAttribute =="" || singleItemPerRowAttribute ? 0 : 1);
		}
		const sameRow= ($(e.target).is(".sortableList") ? 0 : multipleItemsPerRow);
		const destColumnName=dropTarget.title;

		let destRow;
		if(sourceParent==dropParent){
			e.preventDefault();
			const container=_state.find((container)=> container.name==draggedItem.dataset.containerName);
			const sourceColumn=container.columns.find((column)=> column.name==_currentItem.columnName);
			const destColumn=container.columns.find((column)=> column.name==destColumnName);

			if(!sameRow){
				const siblings =[...dropTarget.querySelectorAll(".sortableList .listItem:not(.dragging)")];
				let nextSibling= siblings.find(sibling => {
					return e.clientY <= sibling.offsetTop + sibling.offsetHeight /2;
				})
				if (nextSibling !== undefined){
					destRow=nextSibling.dataset.rowIndex;
				} else {
					destRow=siblings.length;
				}

				const destColumn=container.columns.find((column)=> column.name==destColumnName);
				const item=sourceColumn.data[_currentItem.rowIndex].splice(_currentItem.itemIndex, 1)

				destColumn.data.splice(destRow, 0, item);
				if (sourceColumn.data[_currentItem.rowIndex].length==0){
					sourceColumn.data.splice(_currentItem.rowIndex, 1);
				}

			} else {
				const item=sourceColumn.data[_currentItem.rowIndex].slice(_currentItem.itemIndex, 1)[0]
				destColumn.data[e.target.dataset.rowIndex].push(item)
				sourceColumn.data[_currentItem.rowIndex].splice(_currentItem.itemIndex, 1)
				if (sourceColumn.data[_currentItem.rowIndex].length==0){
					sourceColumn.data.splice(_currentItem.rowIndex, 1);
				}
			}
		}
		if(_callback){
			setTimeout(()=>_callback(_state),100);
		}
		setTimeout(RenderState,1);
	}

	const sortableListContainers = document.querySelectorAll(".sortableListContainer");
	sortableListContainers.forEach((container)=>{
		const sortableList = container.querySelectorAll(".sortableList");
		container.dataset.template=container.querySelector(".details").parentElement.innerHTML;
		let currentContainer={name:container.title,columns:[]}

		sortableList.forEach((list)=>{
			list.addEventListener("dragover", validDropTarget)
			list.addEventListener("dragenter", e => e.preventDefault());
			list.addEventListener("drop", moveItem);
			currentContainer.columns.push({name:list.title, data:[]});
		})
		_state.push(currentContainer)
	})

	function AddDraggableEvents(){
		const t0= performance.now();
		const items = document.querySelectorAll(".sortableList .listItem .details");

		items.forEach(item =>{
			item.draggable=true;
			item.addEventListener("dragstart", () => {
				_currentItem=item.dataset;
				setTimeout(()=>item.classList.add("dragging"),0);
			})
			item.addEventListener("dragend", () => {
				item.classList.remove("dragging");
			})
		})
	}

	function RenderState(){
		const t0= performance.now();
		_state.forEach((container)=>{
			const containerElement=document.querySelector(".sortableListContainer[title='"+ container.name +"']");
			container.columns.forEach((column)=>{
				const columnElement=containerElement.querySelector(".sortableList[title='"+ column.name +"']");
				const newChildren=column.data.map((items, itemIndex)=>{
					const newLi=document.createElement("li");
					newLi.classList.add("listItem");
					newLi.dataset.columnName=column.name;
					newLi.dataset.containerName= container.name;
					newLi.dataset.rowIndex=itemIndex;
					newLi.innerHTML=items.map((item) => {
						if(typeof item == "object") {
							return Object.entries(item).reduce((prev, current)=> prev.replaceAll(`{{${current[0]}}}`, current[1]), containerElement.dataset.template)
						} else {
							return containerElement.dataset.template.replaceAll("{{item}}", item);
						}
					}).join('');
					newLi.querySelectorAll(".details").forEach((detail, index)=>{
						detail.dataset.columnName=column.name;
						detail.dataset.containerName= container.name;
						detail.dataset.rowIndex=itemIndex;
						detail.dataset.itemIndex=index;
					});

					return newLi;
				})
				if(columnElement){
					columnElement.replaceChildren(...newChildren);
				} else {
					console.error(`Column ${column.name} not found.`);
				}
			})
		})
		setTimeout(AddDraggableEvents, 1);
	}

	function setState(state){
		_state=state;
		RenderState();
	}
	function setItems(containerTitle, columnTitle, items){
		const container=_state.find((container)=> container.name==containerTitle);
		const column=container.columns.find((column)=> column.name==columnTitle);
		column.data=items;
		RenderState()
	}

	return {
		set state(state){ setState(state) },
		get state(){return _state},
		setItems,
		set onStateChanged(callback){
			_callback = callback;
		}
	}
}