const promise = fetch(url);

promise.then((res) =>{
    console.log(res);
})

promise.then((data)=>{
    console.log(data)
})