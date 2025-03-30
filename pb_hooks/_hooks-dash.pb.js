routerAdd("GET", "/hooks-dash/folder", function(e)
{
	const IGNORE = ['_hooks-dash.pb.js']

	let path = e.request.url.query().get("path")
	if (path && path.includes('../'))
		throw BadRequestError("Can't escape out of pb_hooks folder")

	return e.json(200, recurseFolder(__hooks + (path ? '/'+path : '')));

	function recurseFolder(folder)
	{
		let files = []
		let list = $os.readDir(folder)
		list.sort()
		let deferred = []
		for (let file of list)
		{
			if (file.isDir())
			{
				let child = {}
				child[file.name()] = recurseFolder(folder+'/'+file.name())
				deferred.push(child)
			}
			else if (!IGNORE.includes(file.name()))
				files.push(file.name())
		}
		for (let file of deferred)
			files.push(file)
		return files
	}
}, $apis.requireSuperuserAuth())


routerAdd("PUT", "/hooks-dash/folder", function(e)
{
	if($app.settings().meta.hideControls)
		throw BadRequestError('Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase superuser dashboard at /_/#/settings')
	
	let path = e.request.url.query().get("path")
	if (!path)
		throw BadRequestError('Must supply path URL parameter')
	if (path.includes('../'))
		throw BadRequestError("Can't escape out of pb_hooks folder")

	//move/rename
	let newPath = e.requestInfo().body.path
	if (newPath)
	{
		if (newPath.includes('../'))
			throw BadRequestError("Can't escape out of pb_hooks folder")
		$os.rename(__hooks+'/'+path, __hooks+'/'+newPath)	
	}
	else
		$os.mkdir(__hooks+'/'+path, 0o755)
}, $apis.requireSuperuserAuth())


routerAdd("GET", "/hooks-dash/file", function(e)
{
	let path = e.request.url.query().get("path")
	if (!path)
		throw BadRequestError('Must supply path URL parameter')
	if (path.includes('../'))
		throw BadRequestError("Can't escape out of pb_hooks folder")
	return e.string(200, toString($os.readFile(__hooks+'/'+path)));
}, $apis.requireSuperuserAuth())


routerAdd("PUT", "/hooks-dash/file", function(e)
{
	if($app.settings().meta.hideControls)
		throw BadRequestError('Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase superuser dashboard at /_/#/settings')
	
	let path = e.request.url.query().get("path")
	if (!path)
		throw BadRequestError('Must supply path URL parameter')
	if (path.includes('../'))
		throw BadRequestError("Can't escape out of pb_hooks folder")

	//move/rename
	let newPath = e.requestInfo().body.path
	if (newPath)
	{
		if (newPath.includes('../'))
			throw BadRequestError("Can't escape out of pb_hooks folder")
		$os.rename(__hooks+'/'+path, __hooks+'/'+newPath)	
		path = newPath
	}

	$os.writeFile(__hooks+'/'+path, e.requestInfo().body.contents, 0o644)
}, $apis.requireSuperuserAuth())


routerAdd("DELETE", "/hooks-dash/file", function(e)
{
	if($app.settings().meta.hideControls)
		throw BadRequestError('Read Only Mode. Switch off "Hide collection create and edit controls" in PocketBase superuser dashboard at /_/#/settings')

	let path = e.request.url.query().get("path")
	if (!path)
		throw BadRequestError('Must supply path URL parameter')
	if (path.includes('../'))
		throw BadRequestError("Can't escape out of pb_hooks folder")
	
	$os.removeAll(__hooks+'/'+path)
}, $apis.requireSuperuserAuth())