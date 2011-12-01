/* <copyright>
 This file contains proprietary software owned by Motorola Mobility, Inc.<br/>
 No rights, expressed or implied, whatsoever to this software are provided by Motorola Mobility, Inc. hereunder.<br/>
 (c) Copyright 2011 Motorola Mobility, Inc.  All Rights Reserved.
 </copyright> */
var Montage = require("montage").Montage;

var Person = Montage.create(Montage, {

    // Not trying to be exhaustive with professional titles/marital distinctions
    // though that would make for a neat example app

    title: {
        dependencies: ["gender"],
        enumerable: false,
        get: function() {

            switch(this.gender) {
                case "male":
                    return "Mr.";
                case "female":
                    return "Mrs.";
                default:
                    return null;
            }

        }
    },

    formalName: {
        dependencies: ["title", "name"],
        get: function() {
            return [this.title, this.name].join(" ").trim();
        },
        set: function() {} //TODO only here for bindings..grr
    },

    name: {
        dependencies: ["firstName", "lastName"],
        enumerable: false,
        get: function() {
            var first = this.firstName ? this.firstName.toCapitalized() : "",
                last = this.lastName ? this.lastName.toCapitalized() : "";

            return first + " " + last;
        },
        set: function() {} //TODO only here to make sure bindings work ok
    },

    gender: {
        enumerable: false,
        value: null
    },

    firstName: {
        enumerable: false,
        value: null
    },

    _lastName: {
        enumerable: false,
        value: null
    },

    lastName: {
        dependencies: ["parent.lastName"],
        enumerable: false,
        get: function() {

            // Certainly not about to delve into naming rules any more touchy than this
            if (this._lastName) {
                // TODO in this case this property is no longer dependent on parent.lastName
                // we probably need a way to programatically add or remove dependencies
                return this._lastName;
            } else if (this.parent) {
                return this.parent.lastName;
            } else {
                return null;
            }
        },
        set: function(value) {
            this._lastName = value;
        }
    },

    parent: {
        enumerable: false,
        value: null
    },

    children: {
        enumerable: false,
        distinct: true,
        value: []
    },

    isParent: {
        dependencies: ["children"],
        enumerable: false,
        get: function() {
            return (this.children.length > 0);
        }
    },

    childrenAtHome: {
        dependencies: ["children.atHome"],
        get: function() {
            return this.children.filter(function(element) {
                return !!element.atHome;
            });
        }
    },

    atHome: {
        enumerable: false,
        value: false
    },

    toString: {
        enumerable: false,
        value: function() {
            return "[Person " + this.name + "]";
        }
    }

});

describe("binding/dependent-properties-spec", function() {

    describe("an object with dependent properties", function() {

        var person;

        beforeEach(function() {
            person = Person.create();
        });

        describe("when adding dependent properties after a prototype was defined", function() {

            it("should accommodate adding dependencies", function() {

                Montage.defineProperty(Person, "jobTitle", {
                    enumerable: false,
                    value: null
                });

                Montage.defineProperty(Person, "businessCard", {
                    enumerable: false,
                    get: function() {
                        return this.formalName + " - " + this.jobTitle;
                    },
                    set: function() {}
                });

                person.firstName = "Alice";
                person.lastName = "Allman";

                var personInformation = {};

                Montage.addDependencyToProperty(Person, "firstName", "businessCard");
                Montage.addDependencyToProperty(Person, "jobTitle", "businessCard");

                Object.defineBinding(personInformation, "businessCard", {
                    boundObject: person,
                    boundObjectPropertyPath: "businessCard"
                });

                person.firstName = "Al";
                person.jobTitle = "Software Engineer";

                expect(personInformation.businessCard).toBe("Al Allman - Software Engineer");
            });

        });

        describe("when removing dependent properties after a prototype was defined", function() {

            it("should remove listeners for the removed dependency if the dependent property is already observed", function() {

                // Doing this on the person not Person to avoid botching all subsequent tests
                Montage.defineProperty(person, "name", {
                    enumerable: false,
                    value: "Foo Bar"
                });

                person.firstName = "Alice";
                person.lastName = "Allman";

                var personInformation = {};

                Montage.removeDependencyFromProperty(Person, "firstName", "name");
                Montage.removeDependencyFromProperty(Person, "lastName", "name");

                Object.defineBinding(personInformation, "name", {
                    boundObject: person,
                    boundObjectPropertyPath: "name"
                });

                person.firstName = "Al";

                expect(person.firstName).toBe("Al");
                expect(personInformation.name).toBe("Foo Bar");

                // Tidying up to make sure everything is back to normal
                Montage.addDependencyToProperty(Person, "firstName", "name");
                Montage.addDependencyToProperty(Person, "lastName", "name");

            });

        });

        describe("when changes actually happen", function() {

            it("should continue affect the actual property changed, regardless of dependencies", function() {

                person.firstName = "Alice";
                person.lastName = "Allman";

                var personInformation = {};

                Object.defineBinding(personInformation, "firstName", {
                    boundObject: person,
                    boundObjectPropertyPath: "firstName"
                });

                person.firstName = "Al";

                expect(personInformation.firstName).toBe("Al");
            });

            it("should affect properties dependent on some other independent property", function() {

                person.firstName = "Alice";
                person.lastName = "Allman";

                var personInformation = {};

                Object.defineBinding(personInformation, "name", {
                    boundObject: person,
                    boundObjectPropertyPath: "name"
                });

                person.firstName = "Al";

                expect(personInformation.name).toBe("Al Allman");
            });

            it("should affect an entire chain of dependent keys", function() {
                person.firstName = "Alice";
                person.lastName = "Allman";

                var personInformation = {};

                Object.defineBinding(personInformation, "formalName", {
                    boundObject: person,
                    boundObjectPropertyPath: "formalName"
                });

                // a change in "firstName" affects "name" which affects "formalName"
                person.firstName = "Al";

                expect(personInformation.formalName).toBe("Al Allman");
            });

            it("should affect properties dependent upon an array that was mutated", function() {
                person.firstName = "Alice";

                var personInformation = {};

                Object.defineBinding(personInformation, "isParent", {
                    boundObject: person,
                    boundObjectPropertyPath: "isParent",
                    oneway: true
                });

                var baby = Person.create();
                baby.firstName = "Bob";

                expect(personInformation.isParent).toBe(false);

                person.children.push(baby);

                expect(personInformation.isParent).toBe(true);
            });

            it("should affect dependent properties involved along a boundPropertyPath that may go beyond the dependent property path", function() {
                person.firstName = "Alice";

                var personInformation = {};

                Object.defineBinding(personInformation, "count", {
                    boundObject: person,
                    boundObjectPropertyPath: "name.length",
                    oneway: true
                });

                person.lastName = "Allman";

                // 11 characters, 12 including the space…
                expect(personInformation.count).toBe(12);
            });

            it("should affect dependent properties concerned with the property of array members", function() {
                var personInformation = {};

                var baby = Person.create(),
                    baby2 = Person.create();

                person.children = [baby, baby2];

                // childrenAtHome depends upon "children.atHome"
                Object.defineBinding(personInformation, "count", {
                    boundObject: person,
                    boundObjectPropertyPath: "childrenAtHome.count()",
                    oneway: true
                });

                expect(personInformation.count).toBe(0);

                baby.atHome = true;
                expect(personInformation.count).toBe(1);

                baby2.atHome = true;
                expect(personInformation.count).toBe(2);

                person.children.pop();
                expect(personInformation.count).toBe(1);
            });

            it("should be dependent on newly added members to an array that is along a dependent property path", function() {
                var personInformation = {};

                var baby = Person.create(),
                    baby2 = Person.create();

                baby.atHome = true;

                // childrenAtHome depends upon "children.atHome"
                Object.defineBinding(personInformation, "count", {
                    boundObject: person,
                    boundObjectPropertyPath: "childrenAtHome.count()",
                    oneway: true
                });

                expect(personInformation.count).toBe(0);

                person.children.push(baby);
                expect(personInformation.count).toBe(1);

                person.children.push(baby2);
                expect(personInformation.count).toBe(1);

                baby2.atHome = true;
                expect(personInformation.count).toBe(2);

            });

            it("TODO must no longer be dependent on removed members of an array that is along a dependent property path", function() {
            });

        });

    });

});
