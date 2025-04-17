// ==UserScript==
// @name         HumbleGrabber
// @namespace    https://github.com/zerolivesleft/HumbleGrabber
// @version      1.0.0
// @description  Easily grab and manage your Humble Choice game keys
// @author       zerolivesleft
// @match        https://www.humblebundle.com/membership/*
// @exclude      https://www.humblebundle.com/membership/home
// @icon         https://www.google.com/s2/favicons?sz=64&domain=humblebundle.com
// @require      http://code.jquery.com/jquery-3.4.1.min.js
// @grant        GM_xmlhttpRequest
// @license      MIT
// @homepage     https://github.com/zerolivesleft/HumbleGrabber
// @supportURL   https://github.com/zerolivesleft/HumbleGrabber/issues
// ==/UserScript==

/**
 * HumbleGrabber - A Violentmonkey userscript for Humble Choice
 * 
 * This script helps you easily grab and manage your Humble Choice game keys.
 * It provides two main functions:
 * 1. Get unredeemed game keys
 * 2. Get all game keys (including already redeemed ones)
 * 
 * The script will display the keys in a modal with options to:
 * - Copy all keys to clipboard
 * - Go to Steam's key redemption page
 */

// Steam API key - you'll need to get your own from https://steamcommunity.com/dev/apikey
const STEAM_API_KEY = 'YOUR_STEAM_API_KEY';

// function that copies the passed in string to the clipboard
function copyToClipboard(keys) {
    navigator.clipboard.writeText(keys);
}

function keyCheck(keysString) {
    // if keysString is empty then return "No keys found"
    if (keysString == "") {
        return "No keys found";
    } else return keysString;
}

// Function to get Steam ID from profile URL
async function getSteamId() {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://store.steampowered.com/account/",
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, "text/html");
                const profileLink = doc.querySelector('.account_dropdown_link');
                if (profileLink) {
                    const steamId = profileLink.href.match(/\/profiles\/(\d+)/)[1];
                    resolve(steamId);
                } else {
                    resolve(null);
                }
            }
        });
    });
}

// Function to check if a game is owned on Steam
async function checkSteamOwnership(appId, steamId) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.steampowered.com/IPlayerService/IsPlayingSharedGame/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&appid_playing=${appId}`,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                resolve(data.response.lender_steamid === "0");
            }
        });
    });
}

// Function to get Steam App ID from game title
async function getSteamAppId(gameTitle) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.steampowered.com/ISteamApps/GetAppList/v2/`,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                const app = data.applist.apps.find(app => 
                    app.name.toLowerCase() === gameTitle.toLowerCase()
                );
                resolve(app ? app.appid : null);
            }
        });
    });
}

async function getKeys(contentChoices) {
    const keys = [];
    const steamId = await getSteamId();
    
    for (choice of contentChoices) {
        let modalOpener = choice.querySelector(".js-open-choice-modal");
        modalOpener.click();
        const modal = document.querySelector(".choice-modal.humblemodal-wrapper");
        const title = modal.querySelector(".js-admin-edit").innerText;
        
        // Get Steam App ID and check ownership
        const appId = await getSteamAppId(title);
        let ownershipStatus = "";
        if (appId && steamId) {
            const isOwned = await checkSteamOwnership(appId, steamId);
            ownershipStatus = isOwned ? " (Already owned on Steam)" : " (Not owned on Steam)";
        }

        // use jquery to get the steam button by innerText and class is .js-keyfield.keyfield.enabled
        let steamButton = $(modal).find(
            '.js-keyfield.keyfield.enabled:contains("Get game on Steam") , a:contains("Steam")'
        )[0];
        if (steamButton != undefined) {
            if (steamButton.innerText == "Steam") {
                steamButton.click();
                console.log("Selecting Steam for redemption");
            }
            // redefine steamButton after clicking it
            steamButton = $(modal).find(
                '.js-keyfield.keyfield.enabled:contains("Get game on Steam") , a:contains("Steam")'
            )[0];
            // if steamButton innerText is "Get game on Steam" then click it
            if (steamButton.innerText == "GET GAME ON STEAM") {
                console.log(`Getting ${title} on Steam`);
                steamButton.click();
                // wait for key to load
                await new Promise((r) => setTimeout(r, 3000));

                const keySection = modal.querySelector(
                    ".js-keyfield.keyfield.redeemed.enabled"
                );
                // get the key using jquery it's in a div with the class .keyfield-value
                const key = $(keySection).find(".keyfield-value")[0].innerText;
                keys.push(`${title}${ownershipStatus}: ${key}`);
            }
        } else {
            console.log("No Steam button found");
        }

        await new Promise((r) => setTimeout(r, 1000));
        const xMark = modal.querySelector(".hb.hb-times");
        xMark.click();
        await new Promise((r) => setTimeout(r, 500));
    }
    // write keys into a single string with newlines
    const keysString = keys.join("\n");
    const finalKeyString = keyCheck(keysString);
    const keysModal = `
    <!-- Modal -->
    <div class="choice-modal humblemodal-wrapper" id="modalWrapper">
      <div
        class="humblemodal-modal humblemodal-modal--open"
        id="keysModal"
        tabindex="-1"
      >
        <div class="js-choice-details">
          <div class="choice-details-wrapper">
            <div class="js-claimed-banner-container">
              <div>
                <div class="claimed-badge js-claimed-badge claimed-banner visible">
                  <div class="claimed-icon" aria-hidden="true">
                    <i class="hb hb-check"></i>
                  </div>
                  <div class="claimed-text">Keys</div>
                </div>
              </div>
            </div>
            <h2 class="title">
              <span class="js-admin-edit" data-entity-kind="display_item">
                Title
              </span>
            </h2>
            <div class="basic-information">
              <span class="genres">Basic Information</span>
            </div>
            <div class="choice-details-content">${finalKeyString}</div>
            <div style="display: flex">
              <a
                id="copyKeys"
                class="choices-secondary-link"
                target="_blank"
                style="
                  background-color: #343a46;
                  color: white;
                  text-decoration: none;
                  text-shadow: none;
                  transition: all 0.2s;
                  border-radius: 4px;
                  box-sizing: border-box;
                  display: block;
                  font-size: 1rem;
                  margin: 1em 1em 0.625em;
                  padding: 0.625em;
                  text-align: center;
                  width: 100%;
                  cursor: pointer;
                  user-select: none;
                "
                >COPY KEYS</a
              >
              <a
                id="redeemOnSteam"
                class="choices-secondary-link"
                target="_blank"
                href="https://store.steampowered.com/account/registerkey"
                target="_blank"
                style="
                  background-color: #343a46;
                  color: white;
                  text-decoration: none;
                  text-shadow: none;
                  transition: all 0.2s;
                  border-radius: 4px;
                  box-sizing: border-box;
                  display: block;
                  font-size: 1rem;
                  margin: 1em 1em 0.625em;
                  padding: 0.625em;
                  text-align: center;
                  width: 100%;
                  cursor: pointer;
                  user-select: none;
                "
                >REDEEM ON STEAM</a
              >
            </div>
            <a
              class="js-close-modal close-modal is-claimed"
              href="javascript:void(0);"
              id="x-button"
            >
              <i class="hb hb-times"></i>
            </a>
          </div>
        </div>
      </div>
    </div>

    `;
    // add keysModal to the body
    $("body").prepend(keysModal);
    const xButton = document.getElementById("x-button");
    // add event listener to xButton to close the modal wrapper
    xButton.addEventListener("click", function () {
      const modalWrapper = document.getElementById("modalWrapper");
      modalWrapper.remove();
    });
    const copyKeysButton = document.getElementById("copyKeys");
    // add event listener to copyKeysButton to copy keys to clipboard
    copyKeysButton.addEventListener("click", function () {
      console.log(finalKeyString);
      copyToClipboard(finalKeyString);
    });
}

window.addEventListener(
    "load",
    function () {
        // Create container for buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginBottom = "10px";

        // Create button for unredeemed keys
        const unredeemedButton = document.createElement("a");
        const unredeemedText = document.createTextNode("GET UNREDEEMED KEYS");
        unredeemedButton.style.cursor = "pointer";
        unredeemedButton.appendChild(unredeemedText);
        unredeemedButton.setAttribute("id", "getUnredeemedKeys");
        unredeemedButton.setAttribute("class", "choices-secondary-link");
        unredeemedButton.style.userSelect = "none";
        unredeemedButton.style.flex = "1";

        // Create button for all keys (including redeemed)
        const allKeysButton = document.createElement("a");
        const allKeysText = document.createTextNode("GET ALL KEYS");
        allKeysButton.style.cursor = "pointer";
        allKeysButton.appendChild(allKeysText);
        allKeysButton.setAttribute("id", "getAllKeys");
        allKeysButton.setAttribute("class", "choices-secondary-link");
        allKeysButton.style.userSelect = "none";
        allKeysButton.style.flex = "1";

        // Add event listeners
        unredeemedButton.addEventListener("click", function () {
            const unredeemedChoices = document.querySelectorAll(".content-choice:not(.claimed)");
            getKeys(unredeemedChoices);
        });

        allKeysButton.addEventListener("click", function () {
            const allChoices = document.querySelectorAll(".content-choice");
            getKeys(allChoices);
        });

        // Add buttons to container
        buttonContainer.appendChild(unredeemedButton);
        buttonContainer.appendChild(allKeysButton);

        const header = document.querySelector(".content-choices-header");
        header.appendChild(buttonContainer);
    },
    false
);
  