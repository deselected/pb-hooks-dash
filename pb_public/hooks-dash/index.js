const DEFAULT_FILE_EXTENSION = '.pb.js'

//piggyback the superuser token from the /_ dashboard
const SUPERUSER_TOKEN = JSON.parse(localStorage.getItem('__pb_superuser_auth__'))?.token
if (!SUPERUSER_TOKEN || JSON.parse(atob(SUPERUSER_TOKEN.split('.')[1])).exp < Math.round(Date.now()/1000))
	window.location.href = window.location.origin + '/_/#/login'

init()
async function init()
{
	//piggyback css files from the /_ dashboard
	let piggybackDOM = new DOMParser().parseFromString(await (await sendRoot('/_')).text(), "text/html")
	for (let element of piggybackDOM.head.querySelectorAll('link[rel="stylesheet"]'))
	{
		element.href = element.href.replace("/hooks-dash/", "/_/")
		document.head.append(element)
	}

	//piggyback hideControls server setting
	if ((await (await sendRoot('/api/settings?fields=meta')).json()).meta.hideControls)
	{
		document.getElementById('editor').querySelector('textarea').disabled = true
		document.getElementById('rename').disabled = true
		document.getElementById('save').disabled = true
		document.getElementById('delete').disabled = true
		document.getElementById('new').disabled = true
		document.getElementById('readOnly').classList.remove('hidden')
	}

	let response = await send('folder')
	if (!response.ok)
		return
	await recurseList(document.getElementById('sideNav'), await response.json())

	let path = new URLSearchParams(window.location.search).get('path')
	if (path)
		displayHook({srcElement: getNavFileElement(decodeURIComponent(path))})
}

async function recurseList(parent, list)
{
	for (let file of list)
	{
		if (file.constructor.name == 'String')
		{
			let navFileElement = createNavFileElement(file)
			parent.append(navFileElement)
			if (file.endsWith('.pb.js'))
			{
				let response = await send('file?path='+getNavFileElementPath(navFileElement))
				if (response.ok)
					parseHooksFile(await response.text(), navFileElement.lastElementChild)
			}
		}
		else
		{	
			let folder = createNavFolderElement(Object.keys(file)[0])
			parent.append(folder)
			recurseList(folder.lastElementChild, Object.values(file)[0])
		}
	}
}

async function displayHook(event, getContents=true)
{
	resetEditor()

	let element = event.srcElement
	while (!element.getAttribute('hook-key'))
		element = element.parentElement

	displayAncestors(element)
	
	element.classList.add('active')

	//set the filename input/rename field
	document.getElementById('filename').value = element.getAttribute('hook-key')

	let path = getNavFileElementPath(element)

	//set the breadcrumbs
	let breadcrumbs = document.body.querySelector('.breadcrumbs')
	for (let node of path.split('/'))
		breadcrumbs.innerHTML += `<div class="breadcrumb-item">${node}</div>`

	//get the file contents and put them in the editor
	let editor = document.getElementById('editor')
	if (getContents)
	{
		let response = await send('file?path='+path)
		if (!response.ok)
			return
		editor.value = await response.text()
	}
	editor.setAttribute('activepath', path)

	//set the syntax highlighting language
	let language = 'JavaScript'
	if (path.toLowerCase().endsWith('sql'))
		language = 'SQL'
	if (path.toLowerCase().endsWith('go'))
		language = 'Go'
	editor.setAttribute('language', language)

	//mod the url for the existing path
	let url = new URL(window.location)
	url.searchParams.set('path', encodeURIComponent(path))
	window.history.replaceState({},null,url)

	document.body.querySelector('.page-wrapper').classList.remove('hidden')
	editor.querySelector('textarea').focus()
}

function resetEditor()
{
	//set everything not active
	for (let active of document.body.querySelectorAll(".active"))
		active.classList.remove('active')

	//reset the breadcrumbs
	let breadcrumbs = document.body.querySelector('.breadcrumbs')
	breadcrumbs.innerHTML = ''

	let editor = document.getElementById('editor')
	editor.value = ''
	editor.removeAttribute('activepath')
	editor.setAttribute('language', 'JavaScript')

	let filename = document.getElementById('filename')
	filename.value = DEFAULT_FILE_EXTENSION
	filename.selectionStart = 0
	filename.selectionEnd = 0

	stopEditName()
}

async function saveHook()
{
	let editor = document.getElementById('editor')
	let body = {contents: editor.value}
	let activepath = editor.getAttribute('activepath')
	let newName = document.getElementById('filename').value
	if (activepath)
	{
		let split = activepath.split('/')
		split[split.length - 1] = newName
		let newPath = split.join('/')
		if (activepath != newPath)
			body.path = newPath

		let response = await send('file?path='+activepath, {method: 'PUT', body: JSON.stringify(body)})
		if (response.ok)
		{
			if (activepath != newPath)
			{	
				//update breadcrumb
				document.body.querySelector('.breadcrumbs').lastElementChild.innerText = newName

				//update side nav
				let element = getNavFileElement(activepath)
				element.querySelector('[shortcut="name"]').innerText = newName
				element.setAttribute('hook-key', newName)

				//update editor activepath
				editor.setAttribute('activepath', newPath)

				stopEditName()
			}
		}
	}
	else
	{
		//TODO handle creating files in folders
		let response = await send('file?path='+newName, {method: 'PUT', body: JSON.stringify(body)})
		if (response.ok)
		{
			//insert new side nav element
			let parent = document.getElementById('sideNav')
			for (let filename of newName.split('/'))
				element = element.querySelector(`[filename="${filename}"]`)
			element.querySelector('[shortcut="name"]').innerText = newName
			let newElement = createNavFileElement(newName)
			parent.insertBefore(newElement, parent.querySelector('div'))

			displayHook({srcElement: newElement}, )
		}
	}
}

async function deleteHook()
{
	let activepath = document.getElementById('editor').getAttribute('activepath')
	if (!confirm(`Confirm you want to delete: `+activepath))
		return
	let response = await send('file?path='+activepath, {method: 'DELETE'})
	if (!response.ok)
		return
	resetEditor()
	document.body.querySelector('.page-wrapper').classList.add('hidden')
	getNavFileElement(activepath).remove()
}

function newHook()
{
	resetEditor()
	document.body.querySelector('.page-wrapper').classList.remove('hidden')
	startEditName()
}

function newFolder()
{
	document.getElementById('newFolder').classList.add('hidden')
	let folderName = document.getElementById('folderName')
	folderName.classList.remove('hidden')
	folderName.value = ''
	folderName.focus()
}

async function saveFolder(event)
{
	let path = document.getElementById('folderName').value.trim()
	if (!path)
		return
	let response = await send('folder?path='+path, {method: 'PUT'})
	if (response.ok)
	{
		stopFolderNameInput()

		//insert new side nav element
		let parent = document.getElementById('sideNav')
		let split = path.split('/')
		for (let filename of split.slice(0,-1))
			parent = parent.querySelector(`[hook-key="${filename}"]`)
		let newElement = createNavFolderElement(split[split.length-1])
		parent.querySelector('.collapse').append(newElement)
	}
}

function stopFolderNameInput()
{
	document.getElementById('newFolder').classList.remove('hidden')
	document.getElementById('folderName').classList.add('hidden')
}

function startEditName()
{
	let filename = document.getElementById('filename')
	filename.classList.remove('hidden')
	filename.focus()
	document.getElementById('rename').classList.add('hidden')
	document.getElementById('cancelRename').classList.remove('hidden')
	document.body.querySelector('.breadcrumbs').classList.add('hidden')
}

function stopEditName()
{
	let filename = document.getElementById('filename')
	filename.classList.add('hidden')
	filename.blur()
	filename.value = document.getElementById('sideNav').querySelector('.active')?.querySelector('[shortcut="name"').innerText || '.pb.js'
	document.getElementById('rename').classList.remove('hidden')
	document.getElementById('cancelRename').classList.add('hidden')
	document.body.querySelector('.breadcrumbs').classList.remove('hidden')
	if (!document.getElementById('editor').getAttribute('activepath'))
		document.body.querySelector('.page-wrapper').classList.add('hidden')
}

function searchHooks(event)
{
	let search = event.srcElement.value.toLowerCase()
	if (!search)
		document.getElementById('clearSearch').classList.add('hidden')	
	else
		document.getElementById('clearSearch').classList.remove('hidden')

	for (let element of document.querySelectorAll('[hook-type]'))
	{
		let candidateString = `${element.getAttribute('hook-type') || ''} ${element.getAttribute('hook-key') || ''}` 
		console.log(candidateString)
		if (candidateString.toLowerCase().includes(search))
		{
			element.classList.remove('hidden')
			displayAncestors(element)
		}
		else
			element.classList.add('hidden')
	}
}

function displayAncestors(element)
{
	let parent = element.parentElement 
	while (parent.id != 'sideNav')
	{
		parent.classList.remove('hidden')
		if (parent.getAttribute('hook-type') == 'folder')
			expand(parent)
		parent = parent.parentElement
	}
}

function clearSearch()
{
	let search = document.getElementById('search')
	search.value = ''; 
	searchHooks({srcElement: search})
}

function createNavFileElement(filename)
{
	return elementFromString(`
		<div hook-type="file" hook-key="${filename}">
			<a class="sidebar-list-item" title="${filename}" onClick="displayHook(event)"><i class="ri-file-line"></i>&nbsp<span shortcut="name">${filename}</span></a>
			<div class="collapse"></div>
		</div>
	`)
}

function getNavFileElement(path)
{
	let element = document.getElementById('sideNav')
	for (let filename of path.split('/'))
		element = element.querySelector(`[hook-key="${filename}"]`)
	return element
}

function getNavFileElementPath(element)
{
	let path = element.getAttribute('hook-key')
	element = element.parentElement
	while (element.id != 'sideNav')
	{
		if (element.getAttribute('hook-key'))
			path = element.getAttribute('hook-key') + '/' + path
		element = element.parentElement
	}
	return path
}


function createNavFolderElement(foldername)
{
	return elementFromString(`
		<div hook-type="folder" hook-key="${foldername}">
			<button type="button" class="sidebar-title m-b-xs link-hint""  title="${foldername}" aria-expanded="0" onClick="toggleCollapse(event)">
					<i class="ri-folder-line"></i>
					<span class="txt">${foldername}</span> 
					<i class="ri-arrow-down-s-line"></i>
			</button>
			<div class="collapse hidden" style="border-left: solid 1px grey; margin-left: 6px; padding-left:2px"></div>
		</div>
	`)
}

function toggleCollapse(event)
{
	let button = event.srcElement
	while (button.tagName != 'BUTTON')
		button = button.parentElement

	button.firstElementChild.classList.toggle('ri-folder-line')
	button.firstElementChild.classList.toggle('ri-folder-open-line')
	button.lastElementChild.classList.toggle('ri-arrow-down-s-line')
	button.lastElementChild.classList.toggle('ri-arrow-up-s-line')
	button.nextElementSibling.classList.toggle('hidden')
}

function expand(element)
{
	element.firstElementChild.firstElementChild.classList.remove('ri-folder-line')
	element.firstElementChild.firstElementChild.classList.add('ri-folder-open-line')
	element.firstElementChild.lastElementChild.classList.remove('ri-arrow-down-s-line')
	element.firstElementChild.lastElementChild.classList.add('ri-arrow-up-s-line')
	element.querySelector('.collapse').classList.remove('hidden')
}
function collapse(element)
{
	element.firstElementChild.firstElementChild.classList.add('ri-folder-line')
	element.firstElementChild.firstElementChild.classList.remove('ri-folder-open-line')
	element.firstElementChild.lastElementChild.classList.add('ri-arrow-down-s-line')
	element.firstElementChild.lastElementChild.classList.remove('ri-arrow-up-s-line')
	element.querySelector('.collapse').classList.add('hidden')
}

async function send(path, opts={})
{
	return await sendRoot('/hooks-dash/'+path, opts)
}

async function sendRoot(path, opts={})
{
	if (!opts.headers)
		opts.headers = {'Content-Type': 'application/json'}
	opts.headers['Authorization'] = SUPERUSER_TOKEN
	try 
	{
		let response = await fetch(window.location.origin+path, opts)
		if (!response.ok)
			toastAlert(`${response.status} - ${(await response.json()).message}`)
		return response
	}
	catch(e)
	{
		toastAlert(e)
	}
}

function toastAlert(message)
{
	document.querySelector('.toasts-wrapper').append(elementFromString(`
		<div class="alert txt-break alert-danger">
			<div class="icon"><i class="ri-alert-line"></i></div> 
			<div class="content">${message}</div> 
			<button type="button" class="close" onClick="clearToasts()"><i class="ri-close-line"></i></button> 
		</div>
	`))
	setTimeout(function() {document.querySelector('.toasts-wrapper').innerHTML = ''}, 5000)
}

function elementFromString(string)
{
	var div = document.createElement("div");
	div.innerHTML = string;
	return div.firstElementChild
}


const MIDDLEWARES = [
	'requireGuestOnly',
	'requireAuth',
	'requireSuperuserAuth',
	'requireSuperuserOrOwnerAuth',
	'bodyLimit',
	'gzip',
	'skipSuccessActivityLog',
]

var EVENT_HOOKS = [
	//app
	'onBootstrap',
	'onSettingsReload',
	'onBackupCreate',
	'onBackupRestore',
	'onTerminate',
	//mailer
	'onMailerSend',
	'onMailerRecordAuthAlertSend',
	'onMailerRecordPasswordResetSend',
	'onMailerRecordVerificationSend',
	'onMailerRecordEmailChangeSend',
	'onMailerRecordOTPSend',
	//realtime
	'onRealtimeConnectRequest',
	'onRealtimeSubscribeRequest',
	'onRealtimeMessageSend',
	//record model
	'onRecordEnrich', //remainder populated below
	//collection model (populated below)
	//request
	//record crud (populated below)
	//record auth
	'onRecordAuthRequest',
	'onRecordAuthRefreshRequest',
	'onRecordAuthWithPasswordRequest',
	'onRecordAuthWithOAuth2Request',
	'onRecordRequestPasswordResetRequest',
	'onRecordConfirmPasswordResetRequest',
	'onRecordRequestVerificationRequest',
	'onRecordConfirmVerificationRequest',
	'onRecordRequestEmailChangeRequest',
	'onRecordConfirmEmailChangeRequest',
	'onRecordRequestOTPRequest',
	'onRecordAuthWithOTPRequest',
	//batch
	'onBatchRequest',
	//file
	'onFileDownloadRequest',
	'onFileTokenRequest',
	//collection (populated below)
	//settings
	'onSettingsListRequest',
	'onSettingsUpdateRequest',
	//base model (populated below)
]
for (let model of ['Record', 'Collection', 'Model'])
{
	EVENT_HOOKS.push(`on${model}Validate`)

	for (let action of ['Create', 'Update', 'Delete'])
	{
		EVENT_HOOKS.push(`on${model}${action}`)
		EVENT_HOOKS.push(`on${model}${action}Execute`)
		EVENT_HOOKS.push(`on${model}After${action}Success`)
		EVENT_HOOKS.push(`on${model}After${action}Error`)

		if (model != 'Model')
			EVENT_HOOKS.push(`on${model}${action}Request`)
	}

	if (model != 'Model')
	{
		EVENT_HOOKS.push(`on${model}sListRequest`)
		EVENT_HOOKS.push(`on${model}ViewRequest`)
	}
}

var PARSED_HOOKS = {
	'Route': {},
	'Event': {},
	'Scheduled Cron Job': {},
	'Command': {},
	'Global Middleware': {},
}

function parseHooksFile(hooksFileContents, parent)
{
	//dummy up the pocketbase api
	let contents = `
		var HOOKS = []

		class Command {constructor(object)	{ HOOKS.push({
			type: 'Command',
			key: object.use,
			use: object.use,
			handler: object.run.toString(),
		})}}
		$app = {rootCmd: {addCommand: function(command) {}}}

		function cronAdd(name, schedule, handler)
		{
			HOOKS.push({
				type: 'Scheduled Cron Job',
				key: name,
				name: name,
				schedule: schedule,
				handler: handler.toString(),
			})
		}

		//builtin middlewares
		$apis = {
	`
	for (let middleware of MIDDLEWARES)
		contents += `${middleware}: function(...args){return "$apis.${middleware}("+ (args.length ? "'"+args.join("','")+"'" :"") +")"},\n`
	contents += `
		} //end of $apis.

		function routerAdd(method, path, handler, ...middlewares)
		{
			var hook = {
				type: 'Route',
				key: method + ' ' + path,
				method: method,
				path: path,
				handler: handler.toString(),
				middlewares: [],
			}
			for (let middleware of middlewares)
				hook.middlewares.push(middleware.toString())
			HOOKS.push(hook)
		}

		class Middleware { 
			handler;
			priority;
			constructor(handler, priority){ 
				this.handler = handler; 
				this.priority = priority;
			}
			toString() {return this.handler.toString()}
		}
		function routerUse(handler)
		{
			HOOKS.push({
				type: 'Global Middleware',
				key: 'Global Middleware',
				handler: handler.toString(),
				priority: handler.priority,
			})
		}
	`
	for (let eventHook of EVENT_HOOKS)
		contents += `function ${eventHook}(handler, ...collections)	{
			HOOKS.push({
				type: 'Event', 
				key: '${eventHook} ' + collections, 
				event: '${eventHook}', 
				handler: handler.toString(), 
				collections: collections,
		})}
	`
	contents += hooksFileContents + ';\nHOOKS'
	let parsedHooks = eval(contents)

	parent.style = "border-left: solid 1px lightgrey; margin-left: 6px; padding-left:2px"

	for (let hook of parsedHooks)
	{
		PARSED_HOOKS[hook.type][hook.key] = hook;
		let label = ''
		if (hook.type == 'Route')
			label = `<strong class="badge" title="Route Method">${hook.method}</strong> <span title="${hook.path}">${hook.path}</span>`
		else if (hook.type == 'Event')
			label = `<span title="${hook.key}">${hook.event} ${hook.collections && hook.collections.length > 0 ? `<strong class="badge">${hook.collections}</strong>` : ''}<span>`
		else if (hook.type == 'Scheduled Cron Job')
			label = `<i class="ri-time-line"></i> ${hook.name}`
		else if (hook.type == 'Command')
			label = `<i class="ri-terminal-box-line"></i> ${hook.use}`
		else if (hook.type == 'Global Middleware')
			label = `<i class="ri-global-line"></i>${hook.type}`
		parent.innerHTML += `<a class="sidebar-list-item" title="${hook.type}" hook-type="${hook.type}" hook-key="${hook.key}" onClick="displayParsedHook(event)">${label}</a>`
	}
}


function displayParsedHook(event)
{
	let element = event.srcElement

	//placeholder, just display the whole parent file until easy-mode is implemented
	while (element.getAttribute('hook-type') != 'file')
		element = element.parentElement
	displayHook({srcElement: element})
	return 

	//TODO display easy mode
	while (!element.getAttribute('hook-type'))
		element = element.parentElement

	let hook = PARSED_HOOKS[element.getAttribute('hook-type')][element.getAttribute('hook-key')]

	document.getElementById('editor').value = hook.handler
}