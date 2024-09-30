import express from "express";
import expressEjsLayouts from "express-ejs-layouts";
import UserHandler from "./app/userHandler,js"; 
import session from "express-session"
import successHTTP from "./app/successHTTP.js";
import Addresses from "./app/Addresses.js";
import getMessageAndSuccess from "./app/getMessageAndSuccess.js";
import checkPermission from "./app/checkPermission.js";
import checkAdminPermission from "./app/checkAdminPermission.js";
import ProductCategories from "./app/ProductCategories.js";

const app = express();

app.set("view engine", "ejs");
app.use(expressEjsLayouts);
app.use(urlencoded({extended: true}));
app.use(express.static("assets"));

app.use(session());

app.use(session({
    secret: "asdf",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24*60*60*1000
    }
}));

const uh = new UserHandler();
const p = new Profile(); 
const a = new Addresses();
const pc = new ProductCategories();

app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
});

app.post("/regisztracio", async (req, res)=> {
    let response;
    try {
        response = await uh.register(req.body); 
    } catch (err) {
        response = err;
    }

    //response.success = response.status.toString(0) === "2";
    response.success = successHTTP(response.status);
    res.status(response.status);

    res.render("public/register_post", {
        layout: "./layout/public_layout",
        message: response.message,
        title: "Regisztráció",
        baseUrl: process.env.BASE_URL,
        page: "regisztracio", 
        success: response.success
    })
});

app.post("/login", async (req, res)=> {
    let response;
    let path;

    try{
        response = uh.login(req.body);
        req.session.userName = response.message.userName;
        req.session.userID = response.message.userID;
        req.session.isAdmin = response.message.isAdmin;

        path = response.message.isAdmin == 0 ? "/user/profil" : "/admin/profil"
    } catch(err) {
        response = err;
    }

    response.success = successHTTP(response.status);


    res.status(response.status).redirect(
        response.success ? path : `/bejelentkezes?message=${response.message[0]}`
    )

})

app.get("/bejelentkezes", (req, res)=> {
    res.render("public/login", {
        layout: "./layouts/public_layout",
        title: "Bejelentkezés",
        baseUrl: process.env.BASE_URL,
        page: "bejelentkezes",
        message: req.query.message ? req.query.message : ""
    })
});

app.get("/user/profil", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const profileData = await p.getProfile(req.session.userID);
        //const messages = req.query.messages.split(",");
        /*
            Mert a getProfile függvény vár egy id-t és az alapján lehozza az összes (*) adatot, ahhoz az id-ű rekordhoz 
        */
        //csináltunk egy segédfüggvényt
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("user/profile", {
            layout: "./layouts/user_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("/user/profil", async (req, res)=> {
    let response;

    try {
        const user = req.body;
        user.userID = req.session.userID;
        response = await p.updateProfile(user);
    } catch(err) {
        response = err;
    }

    console.log(response);

        
    const success = successHTTP(response.status);
    res.redirect(`/user/profil?success=${success}&messages=${response.message}`);
});

app.get("/user/cim-letrehozasa", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            page: "címek",
            addressTypes: addressTypes,
            baseUrl: process.env.BASE_URL,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:{}
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
   
});

app.post("/user/create_address", async (req, res)=> {
    //itt szedjük majd le az adatokat 
    let response;

    try {
        response = await a.createAddress(req.body, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.status);

    if(success) {
        res.status(response.status).redirect(`/user/cim-letrehozasa/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.status(response.status).redirect(`/user/cim-letrehozasa?message=${response.message}&success=${success}`);
    }
    
});

app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const address = await a.getAddressByID(req.params.addressID, req.session.userID);
        console.log(address);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            baseUrl: process.env.BASE_URL,
            page: "címek",
            addressTypes: addressTypes,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:address
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
});

app.post()

app.get("/user/címek", async (req, res)=> {
    let response;

    try {
        checkPermission(req.session.userID),
        response = await a.getAddressesByUser(req.session.userID);
    } catch(err) {
        if(err.status === 403) {
            res.redirect(`/message=${err.message}`);
        }
        response = err;
    }

    res.render("user/addresses", { 
        layout: ".layout/user_layout",
        addresses: response.message,
        baseUrl: process.env.BASE_URL,
        title: "Címek", 
        page: "címek"
    })
});

app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
    /*
        fontos, hogy azokat ami egy url változó query, azt ?xx=xx formátumba kell csinálni   
    */
})

app.get("/admin/profil", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        const profileData = await p.getProfile(req.session.userID);
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("admin/profile", {
            layout: "./layouts/admin_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/felhasznalok", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const users = await uh.search(
            req.session.userID,
            req.session.isAdmin
        )
        
        res.render("admin/users", {
            layout: "./layouts/admin_layout",
            title: "Felhasználok",
            baseUrl: process.env.BASE_URL,
            profileData: users.message,
            page: "felhasznalok", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoriak", async (req, res)=> {
    try {
        // checkAdminPermission(
        //     req.session.userID,
        //     req.session.isAdmin
        // );

        const categories = await pc.getProductCategories(
            // req.session.userID,
            // req.session.isAdmin
        )
        
        res.render("admin/product-categories", {
            layout: "./layouts/admin_layout",
            title: "Termék kategóriák",
            baseUrl: process.env.BASE_URL,
            categories: categories,
            page: "termek-kategoriak", 
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.get("/admin/termek-kategoria", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData: null
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("admin/create-category", async (req, res)=> {
    let response;

    try {
        response = await pc.createCategory(
            req.body,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    if(success) {
        res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    }
});

app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    try {
        checkAdminPermission(
            req.session.userID,
            req.session.isAdmin
        );

        const categoryData = await pc.getCategoryByID(req.params.categoryID);
        /*
            fontos, hogy itt ha response [0][0], akkor azt az egyet kapjuk meg, ami nekünk kell 
            async getCategoryByID(categoryID) {
                 try {
                    const response = await conn.promise().query(
                    "SELECT * FROM product_categories WHERE categoryID = ?"
                    [categoryID]
                    );
                return response[0][0];                        *****
        */
        
        res.render("admin/product-category", {
            layout: "./layouts/admin_layout",
            title: "Termék kategória",
            baseUrl: process.env.BASE_URL,
            page: "termek-kategoria", 
            categoryData:categoryData
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("admin/create-category/:categoryID", async (req, res)=> {
    let response;

    try {

        const categoryData = req.body;
        categoryData.categoryID = req.params.categoryID;
        response = await pc.updateCategory(
            categoryData,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    // if(success) {
    //     res.redirect(`/admin/termek-kategoria/${response.insertID}?message=${response.message}&success=${success}`);
    // } else {
    //     res.redirect(`/admin/termek-kategoria/?message=${response.message}&success=${success}`);
    // }
    //itt nem úgy fogunk eljárni, mert nem response.insertID, hanem req.params.category, ahonnan meg van a szám!! 

    res.redirect(`/admin/termek-kategoria/${req.params.categoryID}/?message=${response.message}&success=${success}`);
});

app.post("/admin/delete-category/:categoryID", async (req, res)=> {
    let response;

    try {
        response = await pc.deleteCategory(
            req.params.categoryID,
            req.session.userID,
            req.session.isAdmin
        );
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/admin/termek-kategoriak/?message=${response.message}&success=${success}`);
});



app.listen(3000, console.log("the app is listening on localhost:3000"));

/*
    product-category.ejs 
    action="<%=baseUrl%>/admin/create-category/<%=categoryData.categoryID ? categoryData.categoryID : ''%>" >

    Itt úgy csináltuk, hogy itt a categoryData
    app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    -> 
    categoryData:categoryData

    itt meg 
    app.get("/admin/termek-kategoria/:categoryID", async (req, res)=> {
    -> 
    categoryData:categoryData

    mert mindkettőnél ez van render-elve 
    res.render("admin/product-category", {

    Miért probléma, ha az van, hogy null 
    Cannot read properties of null (reading categoryID)
    előtte le kell csekkolni, hogy egyáltalán létezik-e a categoryData 
    ->
    action="<%=baseUrl%>/admin/create-category/<%=categoryData ? categoryData.categoryID : ''%>"

    Ha categoryData nem egyenlő null utána lehet és ugyanezt kell a categoryName-vel meg a categoryDesc-vel
    ->
        <input type="text" 
        name="categoryName"
        value="<%=categoryData ? categoryData.categoryName : ''%>">

        <h3>Kategória leírása</h3>
        <textarea style="width: 80%;min-height: 100px;" name="categoryDesc">
            <%=categoryData ? categoryData.categoryDesc : ''%> 
        </textarea>

    
        A button-nél meg a létrehozás kell kiírni, hanem ha categoryData létezik akkor felülírás különben meg létrehozás 
        -> 
        <button>Létrehozás</button>
        ->
        <button>
            <%= categoryData ? "felülírás" : "létrehozás %>">
        </button>

    És ha rákattintunk, hogy felülírás, akkor nincs olyan endpoint-unk, hogy admin/create-category/2
    és ugye ez egy post, mert felül akarjuk írni a meglévő kategorianevet vagy leírást 

    Ezért most megcsináljuk ezt a create-category-t, ami post-os és felülírunk vele 
    ProductCategories.js
    Ez nagyon hasonló lesz, mint a createCategory csak az lesz a neve, hogy updateCategory
    ->
    async updateCategory(category, userID, isAdmin) {
        checkAdminPermission(userID, isAdmin);
        const errors = this.checkData(category);

        if (errors.length > 0) {
            throw {
                status: 400,
                message: errors
            }
        }
            try {
                const response = await conn.promise().query(`
                    UPDATE product_categories SET 
                    categoryName = ? 
                    categoryDesc = ?
                    WHERE categoryID = ?`,
                    [category.categoryName, category.categoryDesc, category.categoryID]
                );
    
                if (response[0].affectedRows === 1) {
                    return {
                        status: 200,
                        message: ["Sikeres feltöltés!"],
                        //insertID: response[0].insertID itt már tudjuk az id-t, ezért nem kell visszaadni ezt az insertID-t 
                    }
                } else {
                    throw {
                        status: 503,
                        message: ["A szolgáltatás jelenleg nem érhető el!"]
                    }
                }
    
    
            } catch (err) {
                console.log("ProductCategories.addCategory", err);
    
                if (err.status) {
                    throw err;
                }
    
                throw {
                    status: 503,
                    message: ["A szolgáltatás jelenleg nem érhető el!"]
                }
            }
        }

Van ez a create-category-nk 
app.post("admin/create-category", async (req, res)=> {
    let response;

    try {
        response = await pc.createCategory(

Ezt lemásoljuk és csinálunk egy create-category:categoryID-t 
-> 
app.post("admin/create-category/:categoryID", async (req, res)=> {
    let response;

    try {

        const categoryData = req.body;
        categoryData.categoryID = req.params.categoryID;
        response = await pc.updateCategory(
            categoryData,
            req.session.userID,
            req.session.isAdmin
        )
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/admin/termek-kategoria/${req.params.categoryID}/?message=${response.message}&success=${success}`);
});

Most már felül tudunk írni egyet 
localhost:3000/admin/termek-kategoria/1
és miután ezt felülírtuk és rányomunk a felülírás gombra, akkor ugyanott maradunk de megmarad a változtatás amit csináltunk 
ez lesz majd az url-ben 
->
localhost:3000/admin/termek-kategoria/1/?message=Sikeres%20mentés&success=true
***************************
Következő a törlés, ezért csinálunk a ProductCategories-ba egy async függvényt -> deleteCategory
    async deleteCategory(categoryID, userID, isAdmin) {
        checkAdminPermission(userID, isAdmin);

        try {
            const response = await conn.promise().query(`
                DELETE from product_categories
                WHERE categoryID = ?`,
                [categoryID]
            )

            if(response[0].affectedRows) {
                return {
                    status: 200,
                    message: ["Sikeres törlés!"]
                }
            } else {
                throw {
                    status: 404,
                    message: ["A bejegyzés nem található az adatbázisban"]
                }
            }
Ennek kell egy endpoint-ot készíteni 
-> 
Ezt is app.post()-ban lehet megoldani, mert írhatnánk azt, hogy app.delete() csak hiába írjuk be a form-ra, hogy ténylegesen delete-be müködjön

app.post("/admin/delete-category/:categoryID", async (req, res)=> {
    let response;

    try {
        response = await pc.deleteCategory(
            req.params.categoryID,
            req.session.userID,
            req.session.isAdmin
        );
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/admin/termek-kategoriak/?message=${response.message}&success=${success}`);  ****
});

Hogy csináljuk meg a product-categories-en a törlést 
Simán lehet, hogy a div-ben létrehozunk egy form-ot 

És elvileg ez elég, mert az action emiatt <%=c.category%> megkapja a categoryID-t az URL-ből, törtléssel (button), meg beküldi a form-ot 
és van egy ilyen endpoint-unk, hogy admin/delete-category!!! 
-> 
app.post("/admin/delete-category/:categoryID"

<div class="container"></div>
<a href="<%= baseUrl%>/admin/termek-kategoria">
    <button>Létrehozás</button>
</a>

    <div class="grid">
        <% categories.forEach(c=> {  %>
            <div class="box">
                <h4>Név</h4>
                <%= c.categoryName%>


                <a href="<%= BASE_URL%>/admin/termek-kategoria/<%=c.categoryID%>">
                    <button>Megnyítás</button>
                </a>

                <form method="post" action="<%=baseUrl%>/admin/delete-category/<%=c.category%>">
                    <button>Törlés</button>
                </form>
            </div>
        <% }) %>
    </div>

És akkor le tudunk törölni
az lesz kiírva az URL-ben, hogy localhost:3000/admin/termek-kategoriak/?message=Sikeres%20törlés!&success=true
*/

