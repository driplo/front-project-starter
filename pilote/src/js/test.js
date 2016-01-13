var test= false;
$("input[type=file]").change(function(){
    var file = $("input[type=file]")[0].files[0];
    alert(file.name + "\n" +
          file.type + "\n" + 
          file.size + "\n" + 
          file.lastModifiedDate);
});

displayAsImage3(file, "preview");

function displayAsImage3(file, containerid) {
    if (typeof FileReader !== "undefined") {
        var container = document.getElementById(containerid),
            img = document.createElement("img"),
            reader;
        container.appendChild(img);
        reader = new FileReader();
        reader.onload = (function (theImg) {
            return function (evt) {
                theImg.src = evt.target.result;
            };
        }(img));
        reader.readAsDataURL(file);
    }
}