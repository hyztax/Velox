// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
// import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-auth.js";

// const firebaseConfig = {
//   apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
//   authDomain: "velox-c39ad.firebaseapp.com",
//   projectId: "velox-c39ad",
//   storageBucket: "velox-c39ad.appspot.com",
//   messagingSenderId: "404832661601",
//   appId: "1:404832661601:web:9ad221c8bfb459410bba20",
//   measurementId: "G-X8W755KRF6"
// };

// const app = initializeApp(firebaseConfig);
// const auth = getAuth();
// onAuthStateChanged(auth, user => console.log("Firebase user:", user));


// Fake products for each section
const homeProducts = [
  { name: "Prod 1", description: "Description 1", price: 10, image: "velox.image/velox_logo.png" },
  { name: "Prod 2", description: "Description 2", price: 12, image: "velox.image/velox_logo.png" },
  { name: "Prod 3", description: "Description 3", price: 15, image: "velox.image/velox_logo.png" },
  { name: "Prod 4", description: "Description 4", price: 18, image: "velox.image/velox_logo.png" },
  { name: "Prod 5", description: "Description 5", price: 20, image: "velox.image/velox_logo.png" },
  { name: "Prod 6", description: "Description 6", price: 20, image: "velox.image/velox_logo.png" },
];

const popularProducts = [
  { name: "Prod 7", description: "Description 7", price: 22, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 8", description: "Description 8", price: 25, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 9", description: "Description 9", price: 28, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 10", description: "Description 10", price: 30, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 11", description: "Description 11", price: 32, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 12", description: "Description 12", price: 20, image: "https://via.placeholder.com/150x80" }
];

const newProducts = [
  { name: "Prod 13", description: "Description 13", price: 12, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 14", description: "Description 14", price: 14, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 15", description: "Description 15", price: 16, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 16", description: "Description 16", price: 18, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 17", description: "Description 17", price: 20, image: "https://via.placeholder.com/150x80" },
  { name: "Prod 18", description: "Description 18", price: 20, image: "https://via.placeholder.com/150x80" }
];// Cart & favorites


// Storage arrays
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentTab = 'cart'; // current sidebar tab

// Render products
function renderProducts(containerId, products) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  products.forEach(product => {
    const inCart = cart.some(p => p.name === product.name);
    const inFav = favorites.includes(product.name);

    const card = document.createElement('div');
    card.classList.add('product-card');
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <span>${product.price} $</span>
        <div class="buttons">
          <button class="add-btn">${inCart ? 'Added ✓' : 'Add'}</button>
          <button class="fav-btn ${inFav ? 'favorited' : ''}">❤</button>
        </div>
      </div>
    `;
    container.appendChild(card);

    const addBtn = card.querySelector('.add-btn');

    if (inCart) {
      addBtn.disabled = true;
      addBtn.style.background = '#4CAF50';
      addBtn.style.cursor = 'default';
    }

    addBtn.addEventListener('click', () => {
      if (!cart.some(p => p.name === product.name)) {
        cart.push({ name: product.name, price: `${product.price} $`, image: product.image });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        markFavorites("home-container");
        markFavorites("popular-container");
        markFavorites("new-container");
        markFavoritesSidebar(); // update sidebar buttons
      }
    });
  });
}

// Initialize all sections
renderProducts("home-container", homeProducts);
renderProducts("popular-container", popularProducts);
renderProducts("new-container", newProducts);

// Mark favorites & cart visually in product lists
function markFavorites(containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.product-card').forEach(card => {
    const name = card.querySelector('h3').textContent;
    const favBtn = card.querySelector('.fav-btn');
    if (favorites.includes(name)) favBtn.classList.add('favorited');
    else favBtn.classList.remove('favorited');

    const addBtn = card.querySelector('.add-btn');
    if (cart.some(p => p.name === name)) {
      addBtn.textContent = 'Added ✓';
      addBtn.disabled = true;
      addBtn.style.background = '#4CAF50';
      addBtn.style.cursor = 'default';
    } else {
      addBtn.textContent = 'Add';
      addBtn.disabled = false;
      addBtn.style.background = '';
      addBtn.style.cursor = 'pointer';
    }
  });
}

// Mark Add buttons in sidebar favorites
function markFavoritesSidebar() {
  const content = document.getElementById('sidebar-content');
  content.querySelectorAll('.add-cart-btn').forEach(btn => {
    const name = btn.closest('.item').querySelector('.info strong').textContent;
    if (cart.some(p => p.name === name)) {
      btn.textContent = 'Added ✓';
      btn.disabled = true;
      btn.style.background = '#4CAF50';
      btn.style.cursor = 'default';
    } else {
      btn.textContent = 'Add';
      btn.disabled = false;
      btn.style.background = '';
      btn.style.cursor = 'pointer';
    }
  });
}

// Section navigation
function showSection(sectionId) {
  document.querySelectorAll('main section').forEach(sec => sec.style.display = 'none');
  document.getElementById(sectionId).style.display = 'block';
}

// Sidebar toggle
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('show');
  showSidebarTab(currentTab);
}

// Sidebar tab switch
function showSidebarTab(tab) {
  currentTab = tab;
  const content = document.getElementById('sidebar-content');
  content.innerHTML = '';
  const allProducts = [...homeProducts, ...popularProducts, ...newProducts];

  if (tab === 'cart') {
    if (cart.length === 0) content.innerHTML = '<p>Your cart is empty</p>';
    cart.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <img src="${item.image}">
        <div class="info">
          <strong>${item.name}</strong><br>
          ${item.price}
        </div>
        <div class="buttons">
          <button class="remove-cart">✖</button>
        </div>
      `;
      div.querySelector('.remove-cart').addEventListener('click', () => removeFromCart(item.name));
      content.appendChild(div);
    });
    if (cart.length > 0) {
      const btn = document.createElement('button');
      btn.className = 'continue-btn';
      btn.textContent = 'Continue';
      btn.addEventListener('click', openPurchaseModal);
      content.appendChild(btn);
    }
  } else if (tab === 'favorites') {
    if (favorites.length === 0) content.innerHTML = '<p>No saved products</p>';
    favorites.forEach(name => {
      const product = allProducts.find(p => p.name === name);
      if (!product) return;

      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <img src="${product.image}">
        <div class="info">
          <strong>${product.name}</strong><br>
          ${product.price} $
        </div>
        <div class="buttons">
          <button class="add-cart-btn">${cart.some(p => p.name === product.name) ? 'Added ✓' : 'Add'}</button>
          <button class="remove-fav-btn">✖</button>
        </div>
      `;

      const addBtn = div.querySelector('.add-cart-btn');
      const removeFavBtn = div.querySelector('.remove-fav-btn');

      addBtn.addEventListener('click', () => {
        if (!cart.some(p => p.name === product.name)) {
          cart.push({ name: product.name, price: `${product.price} $`, image: product.image });
          localStorage.setItem('cart', JSON.stringify(cart));
          updateCartCount();
          markFavorites("home-container");
          markFavorites("popular-container");
          markFavorites("new-container");
          markFavoritesSidebar(); // update sidebar
        }
      });

      removeFavBtn.addEventListener('click', () => removeFavorite(product.name));

      content.appendChild(div);
    });
    markFavoritesSidebar(); // make sure Add buttons reflect current cart
  }
}

// Remove from cart
function removeFromCart(name) {
  cart = cart.filter(p => p.name !== name);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  showSidebarTab('cart');
  markFavorites("home-container");
  markFavorites("popular-container");
  markFavorites("new-container");
  markFavoritesSidebar();
}

// Remove from favorites
function removeFavorite(name) {
  favorites = favorites.filter(f => f !== name);
  localStorage.setItem('favorites', JSON.stringify(favorites));
  markFavorites("home-container");
  markFavorites("popular-container");
  markFavorites("new-container");
  showSidebarTab('favorites');
  markFavoritesSidebar();
}

// Event delegation
document.addEventListener('click', e => {
  if (e.target.classList.contains('add-btn')) {
    const card = e.target.closest('.product-card');
    const name = card.querySelector('h3').textContent;
    const price = card.querySelector('span').textContent;
    const image = card.querySelector('img').src;
    if (!cart.some(p => p.name === name)) cart.push({ name, price, image });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    markFavorites("home-container");
    markFavorites("popular-container");
    markFavorites("new-container");
    markFavoritesSidebar();
  }

  if (e.target.classList.contains('fav-btn')) {
    const card = e.target.closest('.product-card');
    const name = card.querySelector('h3').textContent;
    if (favorites.includes(name)) {
      favorites = favorites.filter(f => f !== name);
      e.target.classList.remove('favorited');
    } else {
      favorites.push(name);
      e.target.classList.add('favorited');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    markFavorites("home-container");
    markFavorites("popular-container");
    markFavorites("new-container");
    showSidebarTab('favorites');
  }
});

// Update cart count
function updateCartCount() {
  document.getElementById('cart-count').textContent = cart.length;
}
updateCartCount();

// Purchase modal
function openPurchaseModal() {
  const modal = document.getElementById('purchase-modal');
  const itemsContainer = document.getElementById('purchase-items');
  const totalPriceEl = document.getElementById('total-price');
  const paypalContainer = document.getElementById('paypal-button-container');

  itemsContainer.innerHTML = '';
  paypalContainer.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const price = parseFloat(item.price);
    total += price;

    const div = document.createElement('div');
    div.className = 'purchase-item';
    div.innerHTML = `${item.name} <span>${price} $</span>`;
    itemsContainer.appendChild(div);
  });

  totalPriceEl.textContent = total;
  modal.style.display = 'flex';

  paypal.Buttons({
    style: { color: 'blue', shape: 'rect', label: 'pay' },
    createOrder: function(data, actions) {
      return actions.order.create({ purchase_units: [{ amount: { value: total } }] });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        alert('Purchase completed! Thank you, ' + details.payer.name.given_name);
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        showSidebarTab('cart');
        markFavorites("home-container");
        markFavorites("popular-container");
        markFavorites("new-container");
        markFavoritesSidebar();
        modal.style.display = 'none';
      });
    },
    onError: function(err) {
      alert('' + err);
    }
  }).render('#paypal-button-container');
}

// Close modal
document.getElementById('close-modal-btn').addEventListener('click', () => {
  document.getElementById('purchase-modal').style.display = 'none';
});

// Continue button
document.addEventListener('click', e => {
  if (e.target.classList.contains('continue-btn')) {
    openPurchaseModal();
  }
});
