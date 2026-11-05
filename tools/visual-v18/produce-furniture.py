"""Original V18 furniture production. Run with Blender --background --python."""
import os, sys, math, random
sys.path.insert(0,os.path.dirname(__file__))
from model_common import *

# Fast deterministic previews keep asset iteration practical on the bundled CPU renderer.
def preview(out,loc=(4.6,3.8,5.5),target=(0,.7,0),ortho=5):
    floor=material('Studio charcoal',(.055,.06,.075),.7)
    box('Preview ground',(0,-.04,0),(200,.08,200),floor,0)
    world=bpy.context.scene.world or bpy.data.worlds.new('Studio environment'); bpy.context.scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.21,1); world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,power,color,position,size in [('Warm softbox',850,(1,.77,.56),(-3,5,2),4),('Cool fill',650,(.65,.75,1),(4,3,-1),3),('Rim',700,(1,.57,.28),(0,4,-3),2)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=xyz(position); o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=xyz(loc)); c=bpy.context.object; c.rotation_euler=(Vector(xyz(target))-c.location).to_track_quat('-Z','Y').to_euler(); c.data.type='ORTHO'; c.data.ortho_scale=ortho; bpy.context.scene.camera=c
    s=bpy.context.scene; s.render.engine='BLENDER_EEVEE_NEXT'; s.render.resolution_x=800; s.render.resolution_y=700; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'; s.render.filepath=os.path.join(out,'preview.png'); s.view_settings.view_transform='AgX'; s.render.film_transparent=False
    bpy.ops.render.render(write_still=True)

def mats():
    global wood,metal,brass,clothmat,ceramic,stone,light,leafmat
    wood=material('Smoked walnut grain',(.115,.063,.037),.42,texture='wood')
    metal=material('Black brushed steel',(.027,.032,.04),.31,.78)
    brass=material('Satin champagne brass',(.43,.25,.10),.3,.82)
    clothmat=material('Graphite woven upholstery',(.075,.085,.09),.84,texture='fabric')
    ceramic=material('Ivory vitreous ceramic',(.78,.75,.68),.19)
    stone=marble()
    light=material('Warm luminous diffuser',(1,.54,.16),.3,emission=3)
    leafmat=material('Living palm leaves',(.045,.16,.065),.62)

def marble():
    m=material('Nero marble with mineral veins',(.035,.03,.027),.22)
    n=1024; yy,xx=np.mgrid[0:n,0:n]; wave=np.sin(xx*.019+yy*.035+2*np.sin(yy*.012)+np.sin(xx*.031)); ridge=np.exp(-np.abs(wave)*95)
    secondary=np.exp(-np.abs(np.sin(xx*.027-yy*.018+np.sin(yy*.04)))*170)
    val=np.clip(.025+ridge*.53+secondary*.18,0,1); a=np.ones((n,n,4),np.float32)
    for k,t in enumerate([1,.87,.68]):a[:,:,k]=val*t
    im=bpy.data.images.new('Original Nero marble 1k',width=n,height=n);im.pixels.foreach_set(a.ravel());im.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return m

def mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata([xyz(v) for v in verts],[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);apply_material(o,mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    return o

def lathe(name,profile,mat,cx=0,cz=0,sx=1,sz=1):
    verts=[];faces=[];n=64
    for r,y in profile:
        for j in range(n):
            t=j*2*math.pi/n;verts.append((cx+r*math.cos(t)*sx,y,cz+r*math.sin(t)*sz))
    for i in range(len(profile)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    return mesh(name,verts,faces,mat)

def beam(name,a,b,r,mat):return tube(name,[a,b],r,mat)
def finish(cat,slug,desc,features,ortho=3.5,target=(0,.75,0)):
    out=export_asset(cat,slug,desc,features);preview(out,target=target,ortho=ortho)

def lamp(x,y,z,scale=1):
    cyl('Lamp weighted base',(x,y+.018,z),.14*scale,.036,brass)
    tube('Articulated lamp stem',[(x,y+.03,z),(x,y+.36*scale,z),(x+.14*scale,y+.58*scale,z)],.012*scale,metal)
    lathe('Spun desk lamp shade',[(.02,y+.61*scale),(.085*scale,y+.6*scale),(.17*scale,y+.49*scale),(.16*scale,y+.478*scale),(.04,y+.58*scale)],metal,x+.14*scale,z)
    cyl('Lamp diffuser',(x+.14*scale,y+.48*scale,z),.151*scale,.008,light)

def desk():
    clear();mats()
    box('Walnut bullnose desktop',(0,.765,0),(2.35,.07,.86),wood,.035,6)
    for x in [-.88,.88]:
        box('Floating drawer cabinet',(x,.4,.04),(.48,.65,.71),wood,.022)
        for j in range(3):
            box('Recessed drawer front',(x,.18+j*.205,.409),(.456,.188,.024),wood,.012)
            box('Brass inset drawer pull',(x,.23+j*.205,.426),(.20,.012,.018),brass,.005)
        for xx in [-.17,.17]:
            for z in [-.23,.28]:box('Cabinet raised foot',(x+xx,.04,z),(.025,.08,.025),metal,.006)
    box('Leather desk mat',(0,.808,.075),(1.06,.008,.44),clothmat,.025)
    box('Monitor foot',(0,.825,-.19),(.35,.028,.23),metal,.025)
    tube('Monitor pedestal',[(0,.84,-.21),(0,1.08,-.24)],.035,metal)
    box('Monitor machined enclosure',(0,1.21,-.26),(.94,.51,.045),metal,.026)
    screen=material('Monitor violet cyan display',(.033,.12,.26),.32,emission=.8)
    box('Display glass',(0,1.213,-.233),(.895,.459,.007),screen,.012)
    for j in range(19):
        h=.025+.19*(.5+.5*math.sin(j*2.1))
        box('Display skyline bars',(-.41+j*.045,1.02+h/2,-.227),(.015,h,.002),material('UI neon '+str(j),(.05,.42,.65),.4,emission=1),.001)
    box('Keyboard chassis',(-.1,.828,.17),(.61,.028,.19),metal,.014)
    key=material('Warm grey keycaps',(.42,.42,.38),.64)
    for row in range(4):
        for col in range(14):box('Individual sculpted key',(-.38+col*.043,.848,.105+row*.041),(.035,.013,.032),key,.004)
    box('Keyboard spacebar',(-.08,.852,.281),(.22,.01,.027),key,.005)
    sphere('Ergonomic mouse',(.45,.84,.18),(.043,.026,.065),metal)
    tube('Mouse wheel',[(.45,.865,.16),(.45,.865,.18)],.004,brass)
    lamp(-.9,.80,-.22,.7)
    for j in range(3):box('Stacked bound notebook',(.91,.824+j*.025,.2),(.23,.023,.29),clothmat,.005)
    cyl('Ceramic pen cup',(.68,.87,-.24),.04,.14,ceramic)
    for i in range(5):beam('Drawing pencil',(.66+i*.008,.87,-.24),(.66+i*.008,1.02+i*.006,-.23),.0025,brass)
    finish('desk','executive-desk','Walnut dual pedestal workstation with individual controls and articulated lamp',['beveled walnut cabinets','6 brass handled drawers','monitor stand and lit display','56 individual keycaps','mouse','leather desk mat','spun shade lamp','books and pencil cup'],3.35)

def chair():
    clear();mats()
    cyl('Gas lift',(0,.28,0),.036,.38,metal)
    for j in range(5):
        t=j*math.tau/5;end=(math.cos(t)*.34,.09,math.sin(t)*.34)
        tube('Cast star leg',[(0,.16,0),(end[0]*.7,.12,end[2]*.7),end],.025,metal)
        for d in [-.021,.021]:
            o=cyl('Twin caster wheel',(end[0]+d,.054,end[2]),.048,.025,metal,32);o.rotation_euler[1]=math.pi/2
    soft('Sculpted waterfall seat',(0,.48,.02),(.55,.12,.50),clothmat,.1,.003)
    tube('Seat welt seam',rounded_rect(0,.50,.02,.52,.47,.1),.0035,brass,True)
    # A curved ergonomic shell generated as a surface, including lumbar bulge and tapered shoulders.
    vs=[];fs=[];nx=22;ny=30
    for j in range(ny+1):
        v=j/ny;y=.54+v*.60;width=.26-.04*v+.025*math.sin(v*math.pi)
        for i in range(nx+1):
            u=i/nx*2-1;z=-.2-.09*v+.075*math.sin(v*math.pi*1.5)+.065*u*u;vs.append((u*width,y,z))
    for j in range(ny):
        for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
    o=mesh('Contoured ventilated backrest',vs,fs,clothmat);mod=o.modifiers.new('Backrest shell thickness','SOLIDIFY');mod.thickness=.024;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for s in [-1,1]:
        tube('Backrest perimeter frame',[(s*(.26-.04*v+.025*math.sin(v*math.pi)),.54+v*.60,-.2-.09*v+.075*math.sin(v*math.pi*1.5)+.065) for v in [i/30 for i in range(31)]],.017,metal)
        tube('Adjustable arm support',[(s*.22,.44,0),(s*.31,.62,.02),(s*.31,.69,-.04)],.017,metal)
        soft('Padded armrest',(s*.31,.71,.04),(.085,.045,.3),clothmat,.025,.001)
    tube('Lumbar spine',[(0,.43,-.22),(0,.67,-.24),(0,.99,-.31)],.029,metal)
    soft('Articulated headrest',(0,1.2,-.27),(.30,.16,.11),clothmat,.05,.002)
    finish('chair','ergonomic-chair','Contoured upholstered task chair with swept lumbar shell and five spoke caster base',['curved mesh backrest','waterfall cushion','welt seam','adjustable arm pads','five spoke base','10 casters','headrest'],1.9,target=(0,.65,0))

def wardrobe():
    clear();mats()
    box('Wardrobe carcass',(0,1.18,0),(1.95,2.36,.63),wood,.025)
    box('Recessed shadow plinth',(0,.07,.01),(1.84,.14,.53),metal,.016)
    for i in range(4):
        x=-.721+i*.481
        box('Full height flush door',(x,1.25,.331),(.465,2.16,.045),wood,.012)
        box('Recessed panel border',(x,1.25,.357),(.394,2.075,.008),metal,.008)
        box('Inset walnut door panel',(x,1.25,.365),(.381,2.061,.012),wood,.009)
        hx=x+(.16 if i%2==0 else -.16)
        for yy in [1.03,1.57]:beam('Handle stand-off',(hx,yy,.38),(hx,yy,.41),.008,brass)
        beam('Long brass wardrobe pull',(hx,1.03,.415),(hx,1.57,.415),.009,brass)
    box('Integrated cornice uplight',(0,2.355,.22),(1.84,.01,.10),light,.004)
    box('Plinth amber strip',(0,.14,.32),(1.84,.009,.009),light,.002)
    finish('wardrobe','paneled-wardrobe','Four full-height inset walnut doors with champagne metal hardware',['inset panels','recessed plinth','4 long brass pulls','cornice light','base light'],3.4,target=(0,1.1,0))

def kitchen():
    clear();mats()
    box('Island floating plinth',(0,.065,0),(2.38,.13,.86),metal,.02)
    box('Island cabinet carcass',(0,.49,0),(2.5,.85,.98),wood,.025)
    # Four separate slabs form a genuine open sink cutout rather than a drawn dark rectangle.
    box('Marble counter left',(-.88,.955,0),(.92,.08,1.12),stone,.025)
    box('Marble counter right',(.81,.955,0),(1.06,.08,1.12),stone,.025)
    for z in [-.43,.43]:box('Marble sink surround',(-.08,.955,z),(.68,.08,.26),stone,.02)
    sink=material('Satin stainless basin',(.31,.35,.37),.24,.84)
    # Rectangular basin with curved rounded corners, tapered sides, rim and closed floor.
    rings=[(.67,.58,.965),(.635,.545,.95),(.60,.51,.88),(.49,.40,.73),(.42,.33,.71)]
    verts=[]
    for w,d,y in rings:verts.extend(rounded_rect(-.08,y,0,w,d,.065,10))
    n=len(verts)//len(rings);faces=[]
    for r in range(len(rings)-1):
        for j in range(n):faces.append((r*n+j,r*n+(j+1)%n,(r+1)*n+(j+1)%n,(r+1)*n+j))
    faces.append(tuple(range((len(rings)-1)*n,len(rings)*n)))
    mesh('Inset rounded stainless sink bowl',verts,faces,sink)
    cyl('Basin drain',(-.08,.716,0),.035,.006,metal)
    tube('Gooseneck faucet',[(-.08,.98,-.38),(-.08,1.24,-.38)]+[(-.08,1.24+.12*math.sin(t),-.26-.12*math.cos(t)) for t in [i*math.pi/24 for i in range(25)]],.018,brass)
    beam('Faucet lever',(.02,.99,-.38),(.02,1.10,-.38),.009,brass)
    for x in [-.83,0,.83]:
        for j in range(3):
            box('Island drawer front',(x,.26+j*.25,.505),(.80,.232,.025),wood,.012)
            box('Brass drawer pull',(x,.32+j*.25,.53),(.36,.012,.021),brass,.005)
    for i in range(38):box('Reeded walnut back',(-1.2+i*.064,.49,-.505),(.026,.75,.025),wood,.012)
    box('Island toe-kick light',(0,.13,.48),(2.36,.008,.008),light,.002)
    cyl('Ceramic fruit bowl foot',(.91,1.01,.06),.08,.03,ceramic)
    lathe('Shallow serving bowl',[(.05,1.02),(.14,1.03),(.19,1.10),(.185,1.11),(.13,1.055),(.05,1.04)],ceramic,.91,.06)
    for i in range(3):sphere('Citrus fruit',(.85+i*.06,1.10,.06),(.052,.05,.05),material('Citrus '+str(i),(.58,.22,.025),.6))
    finish('kitchen','marble-island','Reeded walnut island with actual inset sink cavity, Nero marble slabs and brass fittings',['open basin mesh','gooseneck faucet','9 drawer fronts','brass hardware','reeded back','veined marble','fruit bowl'],3.8)

def stool():
    clear();mats()
    soft('Contoured leather bar seat',(0,.79,0),(.43,.10,.43),clothmat,.10,.002)
    soft('Curved low back cushion',(0,.99,-.17),(.42,.26,.09),clothmat,.06,.002)
    for x in [-1,1]:
        for z in [-1,1]:beam('Tapered bar stool frame',(x*.16,.77,z*.15),(x*.23,.025,z*.23),.013,brass)
    tube('Footrest continuous hoop',rounded_rect(0,.27,0,.41,.41,.04),.013,brass,True)
    for x in [-.18,.18]:beam('Backrest upright',(x,.74,-.17),(x,1.1,-.17),.012,brass)
    tube('Leather stitched edge',rounded_rect(0,.80,0,.41,.41,.08),.003,brass,True)
    finish('stool','leather-bar-stool','Padded leather stool on slender brass splayed frame',['upholstered seat','padded back','stitched perimeter','continuous footrest','splayed tubular legs'],1.65,target=(0,.55,0))

def bathroom():
    clear();mats()
    # Basin/vanity at left, turned sculpted toilet at right. A reusable fixture suite.
    box('Wall hung vanity',(-.58,.58,-.12),(.88,.42,.53),wood,.025)
    for x in [-.8,-.36]:
        box('Vanity door',(x,.58,.157),(.425,.39,.025),wood,.013)
        box('Vanity edge pull',(x,.74,.177),(.30,.008,.014),brass,.003)
    box('Stone vanity top',(-.58,.81,-.12),(.95,.045,.59),stone,.025)
    lathe('Vessel basin ceramic',[(.14,.835),(.24,.85),(.28,.94),(.278,.965),(.254,.966),(.23,.9),(.13,.86),(.02,.86)],ceramic,-.58,-.1,sx=1.25,sz=.85)
    cyl('Basin drain',(-.58,.865,-.1),.021,.007,brass)
    tube('Vanity faucet',[(-.58,.84,-.37),(-.58,1.06,-.37),(-.58,1.07,-.23)],.012,brass)
    mirror=material('Silvered mirror',(.75,.8,.85),.05,1)
    box('Brass mirror frame',(-.58,1.43,-.405),(.88,.85,.035),brass,.035)
    box('Vanity mirror',(-.58,1.43,-.382),(.83,.80,.008),mirror,.029)
    box('Mirror light rail',(-.58,1.88,-.38),(.72,.02,.028),light,.008)
    lathe('Toilet sculpted pedestal',[(.18,.02),(.205,.04),(.19,.14),(.17,.25),(.22,.37),(.29,.43),(.3,.46),(.285,.48),(.245,.46),(.21,.40),(.15,.30),(.02,.29)],ceramic,.53,.1,sx=.76,sz=1.13)
    lathe('Soft close toilet seat ring',[(.296,.475),(.304,.49),(.295,.51),(.23,.515),(.225,.495),(.235,.48),(.296,.475)],ceramic,.53,.1,sx=.76,sz=1.13)
    box('Concealed cistern cover',(.53,.49,-.27),(.40,.77,.22),ceramic,.07,8)
    box('Flush actuator',(.53,.89,-.265),(.14,.012,.075),brass,.022)
    cyl('Soap dispenser',(-.95,.94,-.1),.034,.17,ceramic)
    beam('Soap pump',(-.95,1.04,-.1),(-.89,1.04,-.1),.007,brass)
    finish('bathroom','ceramic-bathroom-suite','Vessel basin vanity and sculpted ceramic toilet suite',['closed basin bowl','sculpted toilet pedestal','open seat ring','cistern','walnut vanity','silvered mirror','brass faucet','soap pump'],3.0,target=(0,.9,0))

def decor():
    clear();mats();random.seed(18)
    lathe('Ceramic palm planter',[(.22,0),(.26,.04),(.30,.42),(.31,.46),(.29,.47),(.275,.42),(.22,.08)],metal)
    cyl('Soil',(0,.41,0),.273,.025,material('Potting soil',(.032,.018,.01),1))
    for j in range(13):
        t=j*math.tau/13+.15;length=.72+random.random()*.4;top=1.04+random.random()*.53
        pts=[]
        for k in range(18):
            v=k/17;r=length*v**1.4;y=.42+(top-.42)*math.sin(v*math.pi*.68)
            pts.append((r*math.cos(t),y,r*math.sin(t)))
        tube('Arched palm frond rachis',pts,.008,leafmat)
        for k in range(4,17):
            x,y,z=pts[k];v=k/17;ll=.25*math.sin(v*math.pi)*(.7+random.random()*.3)
            for s in [-1,1]:
                dx=math.cos(t+s*1.04)*ll;dz=math.sin(t+s*1.04)*ll
                verts=[(x,y,z),(x+dx*.42+math.cos(t)*.018,y+.026,z+dz*.42+math.sin(t)*.018),(x+dx,y-.075,z+dz),(x+dx*.42-math.cos(t)*.018,y+.012,z+dz*.42-math.sin(t)*.018)]
                mesh('Tapered folded palm leaflet',verts,[(0,1,2),(0,2,3)],leafmat)
    finish('decor','potted-palm','Arching palm with individually folded tapered leaflets in turned planter',['13 curved fronds','338 modeled leaflets','soil surface','turned double wall planter'],2.8,target=(0,.8,0))

jobs={'desk':desk,'chair':chair,'wardrobe':wardrobe,'kitchen':kitchen,'stool':stool,'bathroom':bathroom,'decor':decor}
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(jobs)
for name in args:jobs[name]()
