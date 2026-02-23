const axios = require('axios')
const fs = require('fs')

async function updateList() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md')
    //console.log(response.data)
		let txt = response.data
		let si = txt.indexOf('```')+4,ei = txt.lastIndexOf('```')
		myOldTxt = txt.substr(si,ei-si).trim().replaceAll('&amp;','&')
	  	fs.writeFileSync('test.txt', myOldTxt);
	    console.log('订阅长度'+myOldTxt.length)
		/*let hashes = {},lines = myOldTxt.split('\n'),c=0
		
		for(ustr of lines){
			try{
				let u = new URL(ustr)
				hashes[u.protocol + u.username + u.hostname + u.port + u.searchParams.toString()] = ustr
				++c
			}catch{}
		}
		myOldTxt = ''
		for(let k in hashes) myOldTxt += hashes[k]+'\n'
		*/
		
  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

updateList()
//console.log('success')
